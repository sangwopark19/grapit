export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'unspecified';
  country: string;
  birthDate: string;
  isPhoneVerified: boolean;
  role: 'user' | 'admin';
  createdAt: string;
}
