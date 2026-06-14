import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's registered passkeys
    const { data: credentials } = await supabase
      .from('passkey_credentials')
      .select('id')
      .eq('user_id', user.id);

    const rpName = 'Neralla Nexus';
    const parsedUrl = new URL(request.url);
    const rpID = parsedUrl.hostname;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.id),
      userName: user.email || '',
      userDisplayName: user.user_metadata?.full_name || user.email || 'Nexus User',
      attestationType: 'none',
      excludeCredentials: credentials?.map((c) => ({
        id: c.id,
        type: 'public-key',
      })) || [],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    const cookieStore = await cookies();
    cookieStore.set('passkey_registration_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
    });

    return NextResponse.json(options);
  } catch (err: any) {
    console.error('Registration options generation error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('passkey_registration_challenge')?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Expected challenge not found or expired' }, { status: 400 });
    }

    const parsedUrl = new URL(request.url);
    const rpID = parsedUrl.hostname;
    const origin = parsedUrl.origin;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const { id, publicKey, counter } = credential;

      // Base64URL encode id and Base64 encode publicKey for storage
      const credIDBase64 = typeof id === 'string' ? id : Buffer.from(id).toString('base64url');
      const credPubKeyBase64 = Buffer.from(publicKey).toString('base64');

      const { error: dbErr } = await supabase
        .from('passkey_credentials')
        .insert({
          id: credIDBase64,
          user_id: user.id,
          public_key: credPubKeyBase64,
          counter: counter,
        });

      if (dbErr) {
        throw dbErr;
      }

      cookieStore.delete('passkey_registration_challenge');
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Passkey verification failed' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Registration verification error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
