import { NgModule, inject } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SesionStore } from './contextos/iam/aplicacion/sesion.store';

import {
  adminGuard,
  cambioPasswordGuard,
  invitadoGuard,
  operativoGuard,
  responsableGuard,
  sesionGuard,
} from './contextos/iam/aplicacion/guardias';

import { Acceso } from './contextos/iam/presentacion/acceso/acceso';
import { CambiarPassword } from './contextos/iam/presentacion/cambiar-password/cambiar-password';
import { MiEquipo } from './contextos/iam/presentacion/mi-equipo/mi-equipo';
import { Perfil } from './contextos/iam/presentacion/perfil/perfil';
import { Personas } from './contextos/iam/presentacion/personas/personas';
import { Categorias } from './contextos/inventario/presentacion/categorias/categorias';
import { DetalleBien } from './contextos/inventario/presentacion/detalle-bien/detalle-bien';
import { FormularioBien } from './contextos/inventario/presentacion/formulario-bien/formulario-bien';
import { Inventario } from './contextos/inventario/presentacion/inventario/inventario';
import { EstructuraOrganizacional } from './contextos/organizacion/presentacion/estructura/estructura';
import { FormularioPrestamo } from './contextos/prestamos/presentacion/formulario-prestamo/formulario-prestamo';
import { Prestamos } from './contextos/prestamos/presentacion/prestamos/prestamos';
import { Panel } from './contextos/reportes/presentacion/panel/panel';
import { NoEncontrado } from './diseno/no-encontrado/no-encontrado';
import { Principal } from './diseno/principal/principal';

/**
 * Mapa de rutas del sistema (ERS seccion 9.1).
 *
 * <p>RNF-33: cortas, en espanol, en minusculas y semanticas, sin segmentos
 * tecnicos. Las guardias replican el control de acceso del backend, que es la
 * unica validacion autoritativa (RF-04).</p>
 */
const routes: Routes = [
  { path: 'acceso', component: Acceso, canActivate: [invitadoGuard], title: 'Acceso' },
  {
    path: 'cambiar-password',
    component: CambiarPassword,
    canActivate: [cambioPasswordGuard],
    title: 'Cambio de contraseña',
  },
  {
    path: '',
    component: Principal,
    canActivate: [sesionGuard],
    children: [
      // RNF-36: la pagina principal depende del rol. El Administrador entra a
      // la estructura organizacional, que es su primera tarea; el Responsable
      // y el Operador, a su panel.
      { path: '', pathMatch: 'full', redirectTo: () => inject(SesionStore).rutaInicio() },

      // reportes
      { path: 'panel', component: Panel, title: 'Panel de control' },

      // organizacion (ADMIN)
      {
        path: 'direcciones',
        component: EstructuraOrganizacional,
        canActivate: [adminGuard],
        title: 'Direcciones',
      },
      // La pantalla se llamaba "Estructura" hasta la v3.2. Los enlaces
      // guardados y los favoritos del Administrador siguen funcionando.
      { path: 'estructura', pathMatch: 'full', redirectTo: 'direcciones' },

      // iam
      //
      // Las personas del sistema viven en una sola pantalla, con un filtro por
      // rol (RF-28). Hasta la v3.2 eran dos listas separadas —Responsables y
      // Operadores— que solo se distinguian en el rol que mostraban; buscar a
      // alguien obligaba a saber de antemano que rol tenia.
      {
        path: 'personas',
        component: Personas,
        canActivate: [adminGuard],
        title: 'Personas',
      },
      // El asistente de cambio de responsable desaparecio en la v3.3: el
      // relevo es ahora lo que ocurre al asignar el puesto de responsable de
      // una coordinacion que ya lo tiene, y eso se hace desde Personas
      // (RF-28d, RN-08). Las rutas viejas conducen alli en lugar de a una 404.
      { path: 'responsables/:id/relevo', pathMatch: 'full', redirectTo: '/personas' },
      { path: 'responsables', pathMatch: 'full', redirectTo: 'personas' },
      { path: 'operadores', pathMatch: 'full', redirectTo: 'personas' },
      {
        path: 'mi-equipo',
        component: MiEquipo,
        canActivate: [responsableGuard],
        title: 'Mi equipo humano',
      },
      { path: 'cuenta', component: Perfil, title: 'Mi cuenta' },

      // inventario
      { path: 'inventario', component: Inventario, title: 'Inventario' },
      {
        path: 'inventario/nuevo',
        component: FormularioBien,
        canActivate: [operativoGuard],
        title: 'Registrar equipo',
      },
      {
        path: 'inventario/:id/editar',
        component: FormularioBien,
        canActivate: [responsableGuard],
        title: 'Editar equipo',
      },
      { path: 'inventario/:id', component: DetalleBien, title: 'Ficha del equipo' },
      { path: 'categorias', component: Categorias, canActivate: [adminGuard], title: 'Categorias' },

      // prestamos
      { path: 'prestamos', component: Prestamos, title: 'Prestamos' },
      {
        path: 'prestamos/nuevo',
        component: FormularioPrestamo,
        canActivate: [operativoGuard],
        title: 'Registrar préstamo',
      },

      // RNF-34: pagina 404 propia, dentro del armazon para conservar el menu.
      { path: '404', component: NoEncontrado, title: 'Página no encontrada' },
      { path: '**', component: NoEncontrado, title: 'Página no encontrada' },
    ],
  },
  // Ruta desconocida sin sesion: la 404 se muestra fuera del armazon.
  { path: '**', component: NoEncontrado, title: 'Página no encontrada' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
