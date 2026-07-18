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
  preferredName: string;

  @Column({ nullable: true })
  role: string;

  @Column({ nullable: true })
  addressStyle: string;

  @Column({ nullable: true })
  googleAccessToken: string;

  @Column({ nullable: true })
  googleRefreshToken: string;

  @Column({ nullable: true })
  googleTokenExpiry: Date;

  @Column({ nullable: true })
  calendarAccessToken: string;

  @Column({ nullable: true })
  calendarRefreshToken: string;

  @Column({ nullable: true })
  calendarTokenExpiry: Date;

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
  reminderTime: string;

  @Column({ default: false })
  reminderEnabled: boolean;

  @Column({ default: false })
  calendarConnected: boolean;

  @Column({ nullable: true })
  calendarEventId: string;

  @Column({ type: 'json', nullable: true })
  pushSubscription: Record<string, any> | null;

  @Column({ default: 'Europe/Lisbon' })
  timezone: string;

  @Column({ default: 3 })
  priorityDecayDays: number;

  @Column({ type: 'json', nullable: true })
  importantSenders: string[] | null;

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
