<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailScheduledMessage;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

/** Sends "Send later" emails when their time comes, and files a copy in Sent. */
class ScheduledSends
{
    public function __construct(private readonly MailSender $sender)
    {
    }

    /** @return int emails sent */
    public function sendDue(): int
    {
        $sent = 0;

        foreach (GreenmailScheduledMessage::query()->where('status', 'scheduled')->where('send_at', '<=', now())->orderBy('send_at')->limit(100)->get() as $item) {
            // Claim it, so an overlapping run can't send it twice.
            if (GreenmailScheduledMessage::query()->whereKey($item->id)->where('status', 'scheduled')->update(['status' => 'sending']) !== 1) {
                continue;
            }

            $sent += $this->sendOne($item->refresh()) ? 1 : 0;
        }

        return $sent;
    }

    private function sendOne(GreenmailScheduledMessage $item): bool
    {
        try {
            $password = Crypt::decryptString((string) $item->password_encrypted);
            $raw = Storage::disk('local')->get($item->raw_path) ?? throw new RuntimeException('Message file missing.');
        } catch (Throwable) {
            $this->fail($item, 'This email could not be prepared. Please write it again.');

            return false;
        }

        try {
            $raw = $this->sender->sendRaw($raw, $item->owner_email, $item->recipients, $password);
        } catch (TransportExceptionInterface $exception) {
            report($exception);
            $this->fail($item, preg_match('/\b535\b|authenticat/i', $exception->getMessage())
                ? 'Not sent: the mailbox password has changed since it was scheduled.'
                : 'Not sent: '.Str::limit($exception->getMessage(), 160));

            return false;
        }

        rescue(function () use ($item, $password, $raw) {
            $mail = app(MailGateway::class);
            $mail->open($item->owner_email, $password);
            try {
                $mail->append(FolderRoles::pathFor($mail->folders(), 'sent') ?? 'Sent', $raw, ['\\Seen']);
            } finally {
                $mail->close();
            }
        }, report: true);

        Storage::disk('local')->delete($item->raw_path);
        $item->update(['status' => 'sent', 'sent_at' => now(), 'password_encrypted' => null, 'error' => null]);

        return true;
    }

    private function fail(GreenmailScheduledMessage $item, string $error): void
    {
        $item->update(['status' => 'failed', 'error' => $error, 'password_encrypted' => null]);
    }
}
