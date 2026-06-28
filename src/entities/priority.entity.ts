import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('priorities')
export class Priority {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.priorities)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text')
  rawText: string;

  @Column('simple-json', { nullable: true })
  extractedEntities: {
    people?: string[];
    projects?: string[];
    topics?: string[];
    deadlines?: string[];
  };

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
