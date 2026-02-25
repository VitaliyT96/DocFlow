/**
 * Response shape for successful authentication (register/login).
 *
 * Follows the OAuth2 token response convention for consistency,
 * making it familiar for frontend developers integrating with this API.
 */
export class AuthResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;

  constructor(accessToken: string, expiresIn: number) {
    this.accessToken = accessToken;
    this.tokenType = 'Bearer';
    this.expiresIn = expiresIn;
  }
}
