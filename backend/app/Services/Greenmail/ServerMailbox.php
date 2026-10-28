<?php

namespace App\Services\Greenmail;

use App\Models\MailboxRecord;
use App\Services\Greenmail\Exceptions\MailboxSettingsUnavailable;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;

/**
 * The mailbox's settings on the mail server (ISPConfig's mail_user record):
 * the vacation reply, and the custom Sieve rules our filters compile into.
 * ISPConfig writes them into the mailbox's Sieve scripts within a minute.
 */
class ServerMailbox
{
    public function __construct(private readonly IspConfigClient $client) {}

    /** @return array<string, mixed> */
    public function get(string $email): array
    {
        return $this->withMailbox($email, fn (string $session, int $id, int $clientId, array $record) => $record);
    }

    /**
     * Read the record, let $change decide what to update, and save it.
     *
     * @param  callable(array<string, mixed>): array<string, mixed>  $change
     * @return array<string, mixed> the record as saved
     */
    public function modify(string $email, callable $change): array
    {
        return $this->withMailbox($email, function (string $session, int $id, int $clientId, array $record) use ($change) {
            $params = $change($record);

            if ($params !== []) {
                $this->client->mailUserUpdate($session, $clientId, $id, $params);
            }

            return array_merge($record, $params);
        });
    }

    private function withMailbox(string $email, callable $action): mixed
    {
        $email = strtolower($email);
        $mailbox = MailboxRecord::query()->where('email_address', $email)->whereNotNull('ispconfig_mailbox_id')->first();
        $id = (int) ($mailbox?->ispconfig_mailbox_id ?? 0);
        $clientId = (int) ($mailbox?->hostingService?->ispConfigServiceMappings()->first()?->clientMapping?->ispconfig_client_id ?? 0);

        try {
            $session = $this->client->login();
        } catch (IspConfigApiException $exception) {
            report($exception);

            throw new MailboxSettingsUnavailable('The mail server settings could not be reached. Please try again in a moment.');
        }

        try {
            // A mailbox created on the mail server but never linked to a hosting
            // service here: found there by its address instead.
            if ($id === 0 || $clientId === 0) {
                [$id, $clientId] = $this->findOnServer($session, $email);
            }

            $record = $this->client->mailUserGet($session, $id);

            if (! $record || strtolower((string) ($record['email'] ?? '')) !== $email) {
                throw new MailboxSettingsUnavailable;
            }

            return $action($session, $id, $clientId, $record);
        } catch (IspConfigApiException $exception) {
            report($exception);

            throw new MailboxSettingsUnavailable('The mail server settings could not be saved. Please try again in a moment.');
        } finally {
            rescue(fn () => $this->client->logout($session), report: false);
        }
    }

    /**
     * The mail user's id and its ISPConfig client's id, for a mailbox with no
     * record here. The owner is the client behind a linked mailbox in the same
     * ISPConfig group (the same customer), so nothing is guessed.
     *
     * @return array{0: int, 1: int}
     */
    private function findOnServer(string $session, string $email): array
    {
        $found = collect($this->client->mailUserList($session, ['email' => $email]))
            ->first(fn (array $user) => strtolower((string) ($user['email'] ?? '')) === $email);

        $id = (int) ($found['mailuser_id'] ?? 0);
        $group = (string) ($found['sys_groupid'] ?? '');

        if ($id === 0 || $group === '') {
            throw new MailboxSettingsUnavailable;
        }

        $siblings = collect($this->client->mailUserList($session, ['sys_groupid' => $group]))->pluck('mailuser_id')->map(fn ($value) => (string) $value)->all();

        $linked = MailboxRecord::query()->whereIn('ispconfig_mailbox_id', $siblings)->with('hostingService')->get()
            ->first(fn (MailboxRecord $record) => $record->hostingService?->ispConfigServiceMappings()->first()?->clientMapping?->ispconfig_client_id);

        $clientId = (int) ($linked?->hostingService?->ispConfigServiceMappings()->first()?->clientMapping?->ispconfig_client_id ?? 0);

        if ($clientId === 0) {
            throw new MailboxSettingsUnavailable;
        }

        return [$id, $clientId];
    }
}
