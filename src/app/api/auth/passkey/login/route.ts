import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const parsedUrl = new URL(request.url);
    const rpID = parsedUrl.hostname;

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    const cookieStore = await cookies();
    cookieStore.set('passkey_login_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
    });

    return NextResponse.json(options);
  } catch (err: any) {
    console.error('Authentication options generation error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('passkey_login_challenge')?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Expected challenge not found or expired' }, { status: 400 });
    }

    const parsedUrl = new URL(request.url);
    const rpID = parsedUrl.hostname;
    const origin = parsedUrl.origin;

    const adminSupabase = createAdminClient();

    // 1. Fetch credential from DB by id (which is base64url encoded in the DB)
    // Note: client passes body.id which is base64url encoded
    const { data: cred, error: dbErr } = await adminSupabase
      .from('passkey_credentials')
      .select('*')
      .eq('id', body.id)
      .single();

    if (dbErr || !cred) {
      console.error('Credential lookup error:', dbErr);
      return NextResponse.json({ error: 'Biometric credential not registered on this server.' }, { status: 404 });
    }

    // 2. Fetch email from users table to prepare login
    const { data: userRecord, error: userErr } = await adminSupabase
      .from('users')
      .select('email')
      .eq('id', cred.user_id)
      .single();

    if (userErr || !userRecord) {
      console.error('User lookup error:', userErr);
      return NextResponse.json({ error: 'User associated with this biometric credential not found.' }, { status: 404 });
    }

    // 3. Verify assertion
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: Buffer.from(cred.public_key, 'base64'),
        counter: Number(cred.counter),
      },
      requireUserVerification: false,
    });

    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;

      // Update counter in DB
      await adminSupabase
        .from('passkey_credentials')
        .update({ counter: newCounter })
        .eq('id', cred.id);

      // 4. Authenticate user via Supabase OTP link
      const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userRecord.email,
      });

      if (linkErr || !linkData.properties?.email_otp) {
        console.error('Failed to generate magiclink link:', linkErr);
        return NextResponse.json({ error: 'Failed to generate session' }, { status: 500 });
      }

      // Verify OTP on client-side Supabase client to set cookies
      const clientSupabase = await createClient();
      const { error: verifyErr } = await clientSupabase.auth.verifyOtp({
        email: userRecord.email,
        token: linkData.properties.email_otp,
        type: 'magiclink',
      });

      if (verifyErr) {
        console.error('OTP verification failed:', verifyErr);
        return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
      }

      // Clear challenge cookie
      cookieStore.delete('passkey_login_challenge');

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Passkey verification failed' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Authentication verification error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
