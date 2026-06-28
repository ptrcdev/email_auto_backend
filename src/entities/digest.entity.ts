import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('digests')
export class Digest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.digests)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  sentAt: Date;

  @Column()
  date: string;

  @Column({ default: 0 })
  urgentCount: number;

  @Column({ default: 0 })
  needsReviewCount: number;

  @Column({ default: 0 })
  lowPriorityCount: number;

  @Column({ default: false })
  opened: boolean;

  @Column({ nullable: true })
  openedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
