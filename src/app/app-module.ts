import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { App } from './app';
import { AppRoutingModule } from './app-routing-module';

// -------------------------------------------------------------- Compartido
import { errorInterceptor } from './compartido/infraestructura/http/error.interceptor';
import { jwtInterceptor } from './compartido/infraestructura/http/jwt.interceptor';
import { CondicionBien, RevisionPendiente } from './compartido/presentacion/condicion/condicion';
import { Confirmacion } from './compartido/presentacion/confirmacion/confirmacion';
import { EstadoVacio } from './compartido/presentacion/estado-vacio/estado-vacio';
import { Icono } from './compartido/presentacion/icono/icono';
import { Importe } from './compartido/presentacion/importe/importe';
import { Notificaciones } from './compartido/presentacion/notificaciones/notificaciones';
import { Paginador } from './compartido/presentacion/paginador/paginador';
import { Pasos } from './compartido/presentacion/pasos/pasos';

// -------------------------------------------------------------------- Diseno
import { NoEncontrado } from './diseno/no-encontrado/no-encontrado';
import { Principal } from './diseno/principal/principal';

// -------------------------------------------------------- Contexto organizacion
import { OrganizacionPuerto } from './contextos/organizacion/dominio/puertos';
import { OrganizacionHttpAdapter } from './contextos/organizacion/infraestructura/organizacion-http.adapter';
import { EstructuraOrganizacional } from './contextos/organizacion/presentacion/estructura/estructura';

// ----------------------------------------------------------------- Contexto iam
import { AutenticacionPuerto, UsuariosPuerto } from './contextos/iam/dominio/puertos';
import { AutenticacionHttpAdapter } from './contextos/iam/infraestructura/autenticacion-http.adapter';
import { UsuariosHttpAdapter } from './contextos/iam/infraestructura/usuarios-http.adapter';
import { Acceso } from './contextos/iam/presentacion/acceso/acceso';
import { CambiarPassword } from './contextos/iam/presentacion/cambiar-password/cambiar-password';
import { DetallePersona } from './contextos/iam/presentacion/detalle-persona/detalle-persona';
import { FormularioUsuario } from './contextos/iam/presentacion/formulario-usuario/formulario-usuario';
import { MiEquipo } from './contextos/iam/presentacion/mi-equipo/mi-equipo';
import { Perfil } from './contextos/iam/presentacion/perfil/perfil';
import { AsignarPuesto } from './contextos/iam/presentacion/asignar-puesto/asignar-puesto';
import { Personas } from './contextos/iam/presentacion/personas/personas';

// ---------------------------------------------------------- Contexto inventario
import { CategoriasPuerto, EquiposPuerto } from './contextos/inventario/dominio/puertos';
import { CategoriasHttpAdapter } from './contextos/inventario/infraestructura/categorias-http.adapter';
import { EquiposHttpAdapter } from './contextos/inventario/infraestructura/equipos-http.adapter';
import { CapturaFoto } from './contextos/inventario/presentacion/captura-foto/captura-foto';
import { Categorias } from './contextos/inventario/presentacion/categorias/categorias';
import { DetalleBien } from './contextos/inventario/presentacion/detalle-bien/detalle-bien';
import { ResponsableEquipo } from './contextos/inventario/presentacion/responsable-equipo/responsable-equipo';
import { FormularioBien } from './contextos/inventario/presentacion/formulario-bien/formulario-bien';
import { FotoBien } from './contextos/inventario/presentacion/foto-bien/foto-bien';
import { Inventario } from './contextos/inventario/presentacion/inventario/inventario';

// ----------------------------------------------------------- Contexto prestamos
import { PrestamosPuerto } from './contextos/prestamos/dominio/puertos';
import { PrestamosHttpAdapter } from './contextos/prestamos/infraestructura/prestamos-http.adapter';
import { FormularioPrestamo } from './contextos/prestamos/presentacion/formulario-prestamo/formulario-prestamo';
import { Prestamos } from './contextos/prestamos/presentacion/prestamos/prestamos';

// ------------------------------------------------------------ Contexto reportes
import {
  DescargaPuerto,
  ExportacionPuerto,
  FormatoUsoPuerto,
  PanelPuerto,
} from './contextos/reportes/dominio/puertos';
import { DescargaNavegadorAdapter } from './contextos/reportes/infraestructura/descarga-navegador.adapter';
import {
  ExportacionHttpAdapter,
  FormatoUsoHttpAdapter,
  PanelHttpAdapter,
} from './contextos/reportes/infraestructura/reportes-http.adapter';
import { FormatoUso } from './contextos/reportes/presentacion/formato-uso/formato-uso';
import { Panel } from './contextos/reportes/presentacion/panel/panel';

/**
 * Modulo raiz del Sistema de Gestion de Inventarios (INICTEL-UNI).
 *
 * <p>Aqui se cierra la inversion de dependencias del frontend: cada puerto
 * declarado en la capa de dominio de un contexto se enlaza con su adaptador de
 * infraestructura. Cambiar HTTP por otra tecnologia solo exige tocar esta
 * tabla de proveedores.</p>
 */
@NgModule({
  declarations: [
    App,
    Principal,
    NoEncontrado,
    // compartido
    CondicionBien,
    Confirmacion,
    EstadoVacio,
    Icono,
    Notificaciones,
    Paginador,
    Pasos,
    RevisionPendiente,
    // organizacion
    EstructuraOrganizacional,
    // iam
    Acceso,
    AsignarPuesto,
    CambiarPassword,
    DetallePersona,
    FormularioUsuario,
    MiEquipo,
    Perfil,
    Personas,
    // inventario
    CapturaFoto,
    Categorias,
    DetalleBien,
    ResponsableEquipo,
    FormularioBien,
    FotoBien,
    Inventario,
    // prestamos
    FormularioPrestamo,
    Prestamos,
    // reportes
    FormatoUso,
    Panel,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, ReactiveFormsModule, Importe],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),

    // Puertos -> adaptadores
    { provide: OrganizacionPuerto, useExisting: OrganizacionHttpAdapter },
    { provide: AutenticacionPuerto, useExisting: AutenticacionHttpAdapter },
    { provide: UsuariosPuerto, useExisting: UsuariosHttpAdapter },
    { provide: EquiposPuerto, useExisting: EquiposHttpAdapter },
    { provide: CategoriasPuerto, useExisting: CategoriasHttpAdapter },
    { provide: PrestamosPuerto, useExisting: PrestamosHttpAdapter },
    { provide: PanelPuerto, useExisting: PanelHttpAdapter },
    { provide: ExportacionPuerto, useExisting: ExportacionHttpAdapter },
    { provide: FormatoUsoPuerto, useExisting: FormatoUsoHttpAdapter },
    { provide: DescargaPuerto, useExisting: DescargaNavegadorAdapter },
  ],
  bootstrap: [App],
})
export class AppModule {}
