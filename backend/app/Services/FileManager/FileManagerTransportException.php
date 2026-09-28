<?php

namespace App\Services\FileManager;

use RuntimeException;

/**
 * Connection/auth failure talking to the account. Distinguished from other
 * errors so the controller can tell a client "still setting up, try again
 * shortly" (this exception, right after provisioning) from a genuine bug.
 */
class FileManagerTransportException extends RuntimeException
{
}
