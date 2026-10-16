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
    public function __construct(private readonly IspConfigClient $client)
    {
    }

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

        if ($id === 0 || $clientId === 0) {
            throw new MailboxSettingsUnavailable;
        }

        try {
            $session = $this->client->login();
        } catch (IspConfigApiException $exception) {
            report($exception);

            throw new MailboxSettingsUnavailable('The mail server settings could not be reached. Please try again in a moment.');
        }

        try {
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
}
