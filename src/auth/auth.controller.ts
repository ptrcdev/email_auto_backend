import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userRepo: UserRepository,
    private readonly configService: ConfigService,
  ) {}

  private get frontendUrl(): string {
    return this.configService.get('FRONTEND_URL', 'http://localhost:3001');
  }

  // ── Google ──

  @Get('google')
  googleAuth(@Res() res: Response) {
    const url = this.authService.getGoogleAuthUrl('');
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const tokens = await this.authService.handleGoogleCallback(code);

      let isNew = false;
      let user = await this.userRepo.findByEmail(tokens.email);
      if (!user) {
        isNew = true;
        user = await this.userRepo.create({
          email: tokens.email,
          emailProvider: 'google',
          googleAccessToken: tokens.accessToken,
          googleRefreshToken: tokens.refreshToken,
          googleTokenExpiry: tokens.expiryDate,
        });
      } else {
        await this.userRepo.update(user.id, {
          emailProvider: 'google',
          googleAccessToken: tokens.accessToken,
          googleRefreshToken: tokens.refreshToken,
          googleTokenExpiry: tokens.expiryDate,
        });
      }

      const params = new URLSearchParams({
        email: tokens.email,
        new: String(isNew),
      });
      res.redirect(`${this.frontendUrl}/success?${params.toString()}`);
    } catch (error) {
      this.logger.error('Google OAuth failed:', error);
      res.redirect(`${this.frontendUrl}/error`);
    }
  }

  // ── Microsoft ──

  @Get('microsoft')
  microsoftAuth(@Res() res: Response) {
    const url = this.authService.getMicrosoftAuthUrl('');
    res.redirect(url);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const tokens = await this.authService.handleMicrosoftCallback(code);

      let isNew = false;
      let user = await this.userRepo.findByEmail(tokens.email);
      if (!user) {
        isNew = true;
        user = await this.userRepo.create({
          email: tokens.email,
          emailProvider: 'microsoft',
          microsoftAccessToken: tokens.accessToken,
          microsoftRefreshToken: tokens.refreshToken,
          microsoftTokenExpiry: tokens.expiryDate,
        });
      } else {
        await this.userRepo.update(user.id, {
          emailProvider: 'microsoft',
          microsoftAccessToken: tokens.accessToken,
          microsoftRefreshToken: tokens.refreshToken,
          microsoftTokenExpiry: tokens.expiryDate,
        });
      }

      const params = new URLSearchParams({
        email: tokens.email,
        new: String(isNew),
      });
      res.redirect(`${this.frontendUrl}/success?${params.toString()}`);
    } catch (error) {
      this.logger.error('Microsoft OAuth failed:', error);
      res.redirect(`${this.frontendUrl}/error`);
    }
  }

  // ── Shared ──

  @Get('success')
  success() {
    return 'Email connected successfully. You can close this window.';
  }

  @Get('error')
  error() {
    return 'Authorization failed. Please try again.';
  }
}
