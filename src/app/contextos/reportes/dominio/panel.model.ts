import { Rol } from '../../iam/dominio/usuario.model';

/** Par etiqueta-cantidad de las barras del panel. */
export interface Conteo {
  etiqueta: string;
  cantidad: number;
}

/**
 * Indicadores del panel de control (RF-75 .. RF-77).
 *
 * <p>Es una sola respuesta para los tres roles: el backend la calcula segun
 * quien pregunta, y cada panel muestra el subconjunto que le corresponde. Los
 * campos institucionales (direcciones, coordinaciones, sinResponsable) solo
 * traen valor para el Administrador.</p>
 */
export interface PanelControl {
  rol: Rol;
  /** Texto del ambito: "INICTEL-UNI" o el nombre de la coordinacion. */
  ambito: string;
  coordinacionId?: number;

  totalBienes: number;
  operativos: number;
  prestados: number;
  enMantenimiento: number;
  dadosDeBaja: number;
  /** RN-19: devueltos con dano, esperando decision del Responsable. */
  revisionPendiente: number;

  prestamosActivos: number;
  prestamosVencidos: number;
  usuarios: number;

  direcciones: number;
  coordinaciones: number;
  laboratorios: number;
  /** RF-75: alerta critica del panel institucional. */
  sinResponsable: number;

  porCategoria: Conteo[];
  porCondicion: Conteo[];
}
