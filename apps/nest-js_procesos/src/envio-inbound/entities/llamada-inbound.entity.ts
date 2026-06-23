import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('Reporte_Inbound')
export class LlamadaInbound {
  @PrimaryColumn({ name: 'ID_LLAMADA', type: 'varchar', length: 50 })
  ID_LLAMADA: string;

  @Column({
    name: 'FECHA',
    type: 'date',
    nullable: true,
    transformer: {
      to: (value: Date) => value,
      from: (value: string) => value,
    },
  })
  FECHA: string;

  @Column({ name: 'HORA', type: 'varchar', length: 20, nullable: true })
  HORA: string;

  @Column({ name: 'CAMPAÑA', type: 'nvarchar', length: 200, nullable: true })
  CAMPAÑA: string;

  @Column({
    name: 'ESTADO_DE_LLAMADA',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  ESTADO_DE_LLAMADA: string;

  @Column({ name: 'ESTATUS', type: 'nvarchar', length: 100, nullable: true })
  ESTATUS: string;

  @Column({ name: 'AREA', type: 'nvarchar', length: 100, nullable: true })
  AREA: string;

  @Column({
    name: 'HERRAMIENTA',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  HERRAMIENTA: string;

  @Column({ name: 'DID', type: 'varchar', length: 20, nullable: true })
  DID: string;

  @Column({ name: 'ORIGEN', type: 'varchar', length: 20, nullable: true })
  ORIGEN: string;

  @Column({ name: 'TIEMPO', type: 'varchar', length: 20, nullable: true })
  TIEMPO: string;

  @Column({ name: 'ID_GRABACION', type: 'varchar', length: 50, nullable: true })
  ID_GRABACION: string;
}
