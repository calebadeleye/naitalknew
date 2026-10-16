<?php

namespace App\Services\Greenmail;

/**
 * Works out what a mailbox folder is for, from its IMAP special-use flag
 * (\Sent, \Trash …) or — since ISPConfig/Dovecot don't always set them —
 * from its common names.
 */
final class FolderRoles
{
    public const ORDER = ['inbox', 'sent', 'drafts', 'archive', 'junk', 'trash'];

    private const NAMES = [
        'sent' => ['sent', 'sent items', 'sent messages', 'sent mail'],
        'drafts' => ['drafts', 'draft'],
        'junk' => ['junk', 'spam', 'junk e-mail', 'junk email', 'bulk mail'],
        'trash' => ['trash', 'deleted items', 'deleted messages', 'bin'],
        'archive' => ['archive', 'archives'],
    ];

    /** @param  array<int, string>  $attributes */
    public static function detect(string $path, array $attributes = []): ?string
    {
        if (strtoupper($path) === 'INBOX') {
            return 'inbox';
        }

        foreach ($attributes as $attribute) {
            $role = match (strtolower(ltrim((string) $attribute, '\\'))) {
                'sent' => 'sent',
                'drafts' => 'drafts',
                'junk' => 'junk',
                'trash' => 'trash',
                'archive' => 'archive',
                default => null,
            };

            if ($role) {
                return $role;
            }
        }

        $leaf = strtolower(trim((string) preg_replace('/^INBOX[.\/]/i', '', $path)));

        foreach (self::NAMES as $role => $names) {
            if (in_array($leaf, $names, true)) {
                return $role;
            }
        }

        return null;
    }

    /**
     * @param  array<int, array{path: string, role: ?string}>  $folders
     */
    public static function pathFor(array $folders, string $role): ?string
    {
        foreach ($folders as $folder) {
            if ($folder['role'] === $role) {
                return $folder['path'];
            }
        }

        return null;
    }
}
