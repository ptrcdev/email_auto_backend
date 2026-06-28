import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private googleOAuth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.googleOAuth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );
  }

  // ── Google ──

  getGoogleAuthUrl(userId: string): string {
    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
      state: `google:${userId}`,
    });
  }

  async handleGoogleCallback(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiryDate: Date;
    email: string;
  }> {
    const { tokens } = await this.googleOAuth2Client.getToken(code);
    this.googleOAuth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: this.googleOAuth2Client as any });
    const { data } = await oauth2.userinfo.get();

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiryDate: new Date(tokens.expiry_date!),
      email: data.email!,
    };
  }

  createGoogleClient(accessToken: string, refreshToken: string) {
    const client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return client;
  }

  // ── Microsoft ──

  getMicrosoftAuthUrl(userId: string): string {
    const clientId = this.configService.get('MICROSOFT_CLIENT_ID');
    const redirectUri = this.configService.get('MICROSOFT_REDIRECT_URI');
    const scopes = [
      'openid',
      'email',
      'offline_access',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/User.Read',
    ];

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri!)}` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&response_mode=query` +
      `&state=microsoft:${userId}` +
      `&prompt=consent`;
  }

  async handleMicrosoftCallback(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiryDate: Date;
    email: string;
  }> {
    const clientId = this.configService.get('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get('MICROSOFT_SECRET');
    const redirectUri = this.configService.get('MICROSOFT_REDIRECT_URI');

    this.logger.log(`Microsoft token exchange - redirect_uri: "${redirectUri}"`);

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    if (!tokenResponse.ok) {
      this.logger.error('Microsoft token exchange failed:', tokenData);
      throw new Error('Microsoft token exchange failed');
    }

    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await graphResponse.json() as { mail: string; userPrincipalName: string };

    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + tokenData.expires_in);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiryDate,
      email: profile.mail || profile.userPrincipalName,
    };
  }

  async refreshMicrosoftToken(user: {
    microsoftRefreshToken: string;
  }): Promise<{ accessToken: string; expiryDate: Date }> {
    const clientId = this.configService.get('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get('MICROSOFT_SECRET');

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: user.microsoftRefreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read',
      }),
    });

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + data.expires_in);

    return {
      accessToken: data.access_token,
      expiryDate,
    };
  }
}
