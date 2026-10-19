export type Role = 'alumno' | 'docente' | 'admin';
export type CourseStatus = 'borrador' | 'en_revision' | 'publicado' | 'archivado';
export type PaymentStatus = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado';
export type PaymentMethod = 'mercadopago' | 'transferencia' | 'gratis';

export interface Profile {
  id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: Role;
  teacher_request: boolean;
  created_at: string;
}

export interface Course {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: string | null;
  cover_url: string | null;
  hours: number | null;
  price_ars: number;
  status: CourseStatus;
  review_notes: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  position: number;
  title: string;
  video_url: string | null;
  content: string;
}

export interface Payment {
  id: string;
  user_id: string;
  course_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount_ars: number;
  platform_fee_ars: number;
  teacher_amount_ars: number;
  receipt_path: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface Certificate {
  id: string;
  code: string;
  user_id: string;
  course_id: string;
  holder_name: string;
  course_title: string;
  hours: number | null;
  issued_at: string;
}
