import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../entities/user.entity';
import { Priority } from '../entities/priority.entity';
import { EmailRecord } from '../entities/email-record.entity';
import { Digest } from '../entities/digest.entity';
import { Init1719612000000 } from './migrations/1719612000000-Init';


config();

const isProduction = process.env.NODE_ENV === 'production';

let dataSourceOptions: DataSourceOptions;

if (process.env.DATABASE_URL) {
  dataSourceOptions = {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, Priority, EmailRecord, Digest],
    migrations: [Init1719612000000],
    synchronize: false,
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : false
  };
} else {
  dataSourceOptions = {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'email_auto',
    entities: [User, Priority, EmailRecord, Digest],
    migrations: ['dist/database/migrations/*.js'],
    synchronize: false,
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : false
  };
}

export const AppDataSource = new DataSource(dataSourceOptions);