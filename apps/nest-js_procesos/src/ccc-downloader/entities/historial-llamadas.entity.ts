import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('HistorialLlamadas')
export class HistorialLlamadas {
  @PrimaryGeneratedColumn()
  ID: number;

  @Index()
  @Column({ name: 'Cta', type: 'nvarchar', length: 50, nullable: true })
  cta: string;

  @Index()
  @Column({ name: 'CallID', type: 'nvarchar', length: 100, nullable: true })
  callID: string;

  @Column({ name: 'Type', type: 'nvarchar', length: 100, nullable: true })
  type: string;

  @Column({ name: 'Campaign', type: 'nvarchar', length: 200, nullable: true })
  campaign: string;

  @Index()
  @Column({ name: 'Agent', type: 'nvarchar', length: 200, nullable: true })
  agent: string;

  @Column({ name: 'CallerID', type: 'nvarchar', length: 100, nullable: true })
  callerID: string;

  @Column({
    name: 'CalledNumber',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  calledNumber: string;

  @Column({
    name: 'Destination',
    type: 'nvarchar',
    length: 200,
    nullable: true,
  })
  destination: string;

  @Index()
  @Column({
    name: 'AnswerState',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  answerState: string;

  @Column({ name: 'AMDStatus', type: 'nvarchar', length: 100, nullable: true })
  amdStatus: string;

  @Column({
    name: 'HangupReason',
    type: 'nvarchar',
    length: 200,
    nullable: true,
  })
  hangupReason: string;

  @Column({ name: 'HangupCode', type: 'int', nullable: true })
  hangupCode: number;

  @Column({ name: 'HangupCodeSIP', type: 'int', nullable: true })
  hangupCodeSIP: number;

  @Column({ name: 'DurationSeconds', type: 'float', nullable: true })
  durationSeconds: number;

  @Column({ name: 'DurationMinutes', type: 'float', nullable: true })
  durationMinutes: number;

  @Column({ name: 'BillTimeMinutes', type: 'float', nullable: true })
  billTimeMinutes: number;

  @Column({ name: 'BillRate', type: 'float', nullable: true })
  billRate: number;

  @Column({ name: 'BillCost', type: 'float', nullable: true })
  billCost: number;

  @Index()
  @Column({ name: 'StartDateTime', type: 'date', nullable: true })
  startDateTime: Date;

  @Column({
    name: 'AnswerDateTime',
    type: 'nvarchar',
    length: 50,
    nullable: true,
  })
  answerDateTime: string;

  @Column({
    name: 'HangupDateTime',
    type: 'nvarchar',
    length: 50,
    nullable: true,
  })
  hangupDateTime: string;

  @Column({ name: 'Lead ID', type: 'nvarchar', length: 100, nullable: true })
  leadID: string;

  @Column({ name: 'List ID', type: 'nvarchar', length: 100, nullable: true })
  listID: string;

  @Column({ name: 'Hora', type: 'time', nullable: true })
  hora: string;
}
