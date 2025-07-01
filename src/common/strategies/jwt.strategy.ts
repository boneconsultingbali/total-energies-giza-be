import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.tbm_user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        profile: true,
      },
    });

    if (!user || !user.is_active || user.is_deleted) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Check if user is locked
    if (user.locked_until && new Date() < user.locked_until) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.role?.permissions.map(rp => rp.permission.name) || [],
      profile: user.profile,
    };
  }
}