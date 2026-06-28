import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Priority } from './priority.entity.js';
import { EmailRecord } from './email-record.entity.js';
import { Digest } from './digest.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  whatsappNumber: string;

  @Column({ default: false })
  whatsappOptedIn: boolean;

  @Column({ nullable: true })
  googleAccessToken: string;

  @Column({ nullable: true })
  googleRefreshToken: string;

  @Column({ nullable: true })
  googleTokenExpiry: Date;

  @Column({ nullable: true })
  microsoftAccessToken: string;

  @Column({ nullable: true })
  microsoftRefreshToken: string;

  @Column({ nullable: true })
  microsoftTokenExpiry: Date;

  @Column({ default: 'google' })
  emailProvider: 'google' | 'microsoft';

  @Column({ default: '08:00' })
  digestTime: string;

  @Column({ default: '18:00' })
  whatsappPromptTime: string;

  @Column({ default: 'Europe/Lisbon' })
  timezone: string;

  @Column({ default: 3 })
  priorityDecayDays: number;

  @OneToMany(() => Priority, (priority) => priority.user)
  priorities: Priority[];

  @OneToMany(() => EmailRecord, (email) => email.user)
  emails: EmailRecord[];

  @OneToMany(() => Digest, (digest) => digest.user)
  digests: Digest[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
