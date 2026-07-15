<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Same check as Laravel's stock EnsureEmailIsVerified, with one addition:
 * an admin impersonating a client (see ClientLifecycleController::impersonate)
 * always passes through, regardless of the underlying client's own
 * verification status — impersonation is already gated behind
 * role:super_admin,admin_staff and fully audited, so the client's unverified
 * email shouldn't block an admin fixing something on their behalf. This API
 * is JSON-only, so the stock middleware's redirect-to-verification-notice
 * branch is dropped.
 *
 * Distinguishing an impersonation session has to be done by the token's
 * `name` column, not a Sanctum ability: both an impersonation token and a
 * normal login token get the default '*' ability, and '*' satisfies every
 * can($ability) check regardless of what else is granted — so ability-based
 * checks can't tell them apart, only the name can.
 */
class EnsureEmailIsVerifiedOrImpersonating
{
    private const IMPERSONATION_TOKEN_NAME = 'admin-impersonation';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->currentAccessToken()?->name === self::IMPERSONATION_TOKEN_NAME) {
            return $next($request);
        }

        if (! $user || ($user instanceof MustVerifyEmail && ! $user->hasVerifiedEmail())) {
            abort(403, 'Your email address is not verified.');
        }

        return $next($request);
    }
}
