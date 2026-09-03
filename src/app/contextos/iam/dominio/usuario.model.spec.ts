import { Usuario, coordinacionDe, normalizarUsuario } from './usuario.model';

/**
 * La persona sin puesto tal como la manda el servidor (RF-16b).
 *
 * <p>La API serializa sin los campos nulos, asi que quien no tiene rol llega
 * <b>sin</b> la propiedad, no con ella en null. Es el caso que rompio la
 * ventana de asignacion: `undefined !== null` es cierto, de modo que la
 * pantalla creia que toda persona recien registrada ya tenia puesto y no
 * llegaba a ofrecer ni el rol ni la coordinacion.</p>
 */
const RECIEN_REGISTRADA = {
  id: 4,
  username: 'scampos',
  nombres: 'Sofia',
  primerApellido: 'Campos',
  segundoApellido: 'Ruiz',
  nombreCompleto: 'Sofia Campos Ruiz',
  dni: '41200011',
  correo: 'sofia.campos@inictel-uni.edu.pe',
  rolEtiqueta: 'Sin asignar',
  sinAsignar: true,
  estado: 'ACTIVA',
  estadoEtiqueta: 'Activa',
  debeCambiarPassword: true,
  bloqueado: false,
  fechaCreacion: '2026-08-31T10:46:18',
} as unknown as Usuario;

describe('Persona que llega de la API', () => {
  it('la registrada sin puesto queda con rol null, no ausente', () => {
    const persona = normalizarUsuario(RECIEN_REGISTRADA);

    expect(persona.rol).toBeNull();
    // La comprobacion que hace la ventana de asignacion: sin puesto todavia.
    expect(persona.rol !== null).toBe(false);
    expect(persona.coordinaciones).toEqual([]);
  });

  it('a quien tiene puesto no le cambia nada', () => {
    const conPuesto = {
      ...RECIEN_REGISTRADA,
      rol: 'RESPONSABLE',
      rolEtiqueta: 'Responsable',
      sinAsignar: false,
      coordinaciones: [{ id: 1, nombre: 'Coordinacion de Redes' }],
    } as unknown as Usuario;

    const persona = normalizarUsuario(conPuesto);

    expect(persona.rol).toBe('RESPONSABLE');
    expect(coordinacionDe(persona)).toBe('Coordinacion de Redes');
  });
});
