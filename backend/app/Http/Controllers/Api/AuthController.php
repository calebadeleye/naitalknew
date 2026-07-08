<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request)
    {
        $payload = $request->validated();

        $user = User::query()->create([
            'name' => $payload['name'],
            'email' => $payload['email'],
            'password' => $payload['password'],
            'phone' => $payload['phone'] ?? null,
            'role' => 'client',
            'account_status' => 'pending_verification',
        ]);

        $client = Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CLT-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
            'company_name' => $payload['company_name'] ?? null,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'status' => 'active',
            'billing_email' => $user->email,
            'billing_phone' => $user->phone,
            'billing_address' => $payload['billing_address'] ?? null,
            'last_activity_at' => now(),
        ]);

        $user->sendEmailVerificationNotification();

        return response()->json([
            'token' => $user->createToken('react-client')->plainTextToken,
            'user' => $user->load('client'),
            'client' => $client,
            'message' => 'Your account has been created successfully. Please check your email to verify your account.',
        ], 201);
    }

    public function login(LoginRequest $request)
    {
        $credentials = $request->validated();

        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $user->client?->forceFill(['last_activity_at' => now()])->save();

        return response()->json([
            'token' => $user->createToken($credentials['device_name'] ?? 'react-client')->plainTextToken,
            'user' => $user,
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()->where('email', $payload['email'])->first();
        $token = null;

        if ($user) {
            $token = Str::random(64);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                [
                    'token' => Hash::make($token),
                    'created_at' => now(),
                ]
            );
        }

        return response()->json([
            'message' => 'If this email exists, a password reset link has been prepared.',
            'reset_token' => config('app.debug') ? $token : null,
            'reset_url' => config('app.debug') && $token
                ? rtrim(config('app.url'), '/').'/client/reset-password?email='.urlencode($payload['email']).'&token='.$token
                : null,
        ]);
    }

    public function resetPassword(Request $request)
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $reset = DB::table('password_reset_tokens')->where('email', $payload['email'])->first();

        if (! $reset || ! Hash::check($payload['token'], $reset->token)) {
            throw ValidationException::withMessages([
                'email' => ['The reset token is invalid or has expired.'],
            ]);
        }

        if ($reset->created_at && now()->diffInMinutes($reset->created_at) > 60) {
            DB::table('password_reset_tokens')->where('email', $payload['email'])->delete();
            throw ValidationException::withMessages([
                'email' => ['The reset token is invalid or has expired.'],
            ]);
        }

        User::query()
            ->where('email', $payload['email'])
            ->firstOrFail()
            ->forceFill(['password' => $payload['password']])
            ->save();

        DB::table('password_reset_tokens')->where('email', $payload['email'])->delete();

        return response()->json(['message' => 'Password reset successfully. You can now sign in.']);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load('client'),
        ]);
    }

    public function resendVerification(Request $request)
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already verified.']);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification code sent. Please check your inbox.']);
    }

    public function verifyCode(Request $request)
    {
        $payload = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already verified.']);
        }

        if (! $user->verification_code || ! $user->verification_code_expires_at || $user->verification_code_expires_at->isPast()) {
            throw ValidationException::withMessages([
                'code' => ['This verification code has expired. Please request a new one.'],
            ]);
        }

        if (! Hash::check($payload['code'], $user->verification_code)) {
            throw ValidationException::withMessages([
                'code' => ['That verification code is incorrect.'],
            ]);
        }

        $user->markEmailAsVerified();
        $user->forceFill([
            'account_status' => 'active',
            'verification_code' => null,
            'verification_code_expires_at' => null,
        ])->save();

        return response()->json(['message' => 'Your email has been verified successfully. Your NAI TALK account is now active.']);
    }
}
