<?php

namespace App\Services\Ispconfig\Exceptions;

use RuntimeException;
use Throwable;

class IspConfigApiException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(string $message, protected array $context = [], ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    /**
     * @return array<string, mixed>
     */
    public function context(): array
    {
        return $this->context;
    }

    /**
     * A message safe to persist in logs/database/user-facing responses —
     * never includes remote credentials or raw SOAP fault detail that might
     * echo request parameters back.
     */
    public function safeMessage(): string
    {
        return 'ISPConfig API request failed: '.($this->context['method'] ?? 'unknown method').' could not be completed.';
    }

    public static function fromSoapFault(string $method, Throwable $fault, array $params = []): self
    {
        return new self(
            "ISPConfig SOAP call [{$method}] failed: {$fault->getMessage()}",
            [
                'method' => $method,
                'params' => self::redact($params),
            ],
            $fault,
        );
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private static function redact(array $params): array
    {
        $redacted = [];

        foreach ($params as $key => $value) {
            if (is_array($value)) {
                $redacted[$key] = self::redact($value);

                continue;
            }

            $redacted[$key] = preg_match('/pass|secret|token|credential/i', (string) $key) === 1
                ? '[redacted]'
                : $value;
        }

        return $redacted;
    }
}
