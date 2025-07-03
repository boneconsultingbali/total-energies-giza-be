import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class UserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Remove sensitive data from user objects
        if (data && typeof data === "object") {
          return this.removeSensitiveData(data);
        }
        return data;
      })
    );
  }

  private removeSensitiveData(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.removeSensitiveData(item));
    }

    if (data && typeof data === "object" && !(data instanceof Date)) {
      // Create a shallow copy without stripping prototypes
      const cleanData = { ...data };

      // Remove sensitive fields safely
      delete cleanData.password;
      delete cleanData.reset_token;
      delete cleanData.reset_token_expires;

      // Recursively clean nested objects
      for (const key of Object.keys(cleanData)) {
        const value = cleanData[key];
        if (value && typeof value === "object") {
          cleanData[key] = this.removeSensitiveData(value);
        }
      }

      return cleanData;
    }

    return data;
  }
}
