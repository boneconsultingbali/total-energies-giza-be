import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class UserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // Remove sensitive data from user objects
        if (data && typeof data === 'object') {
          return this.removeSensitiveData(data);
        }
        return data;
      }),
    );
  }

  private removeSensitiveData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.removeSensitiveData(item));
    }

    if (data && typeof data === 'object') {
      if (data.data && Array.isArray(data.data)) {
        // Handle paginated results
        return {
          ...data,
          data: data.data.map(item => this.removeSensitiveData(item)),
        };
      }

      // Remove password and other sensitive fields
      const { password, reset_token, reset_token_expires, ...cleanData } = data;
      
      // Recursively clean nested objects
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] && typeof cleanData[key] === 'object') {
          cleanData[key] = this.removeSensitiveData(cleanData[key]);
        }
      });

      return cleanData;
    }

    return data;
  }
}