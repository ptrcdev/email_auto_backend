import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';

export type EmailCategory = 'urgent' | 'needs_review' | 'low_priority';

@Entity('email_records')
export class EmailRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.emails)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  gmailMessageId: string;

  @Column()
  subject: string;

  @Column()
  sender: string;

  @Column('text', { nullable: true })
  bodyPreview: string;

  @Column()
  receivedAt: Date;

  @Column({
    type: 'varchar',
    default: 'low_priority',
  })
  category: EmailCategory;

  @Column('text', { nullable: true })
  summary: string;

  @Column('text', { nullable: true })
  suggestedAction: string;

  @Column('simple-json', { nullable: true })
  extractedFields: {
    amount?: string;
    projectName?: string;
    deadline?: string;
    senderRole?: string;
  };

  @Column({ default: false })
  includedInDigest: boolean;

  @Column({ nullable: true })
  digestId: string;

  @CreateDateColumn()
  createdAt: Date;
}
