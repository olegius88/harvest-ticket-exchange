// front/src/routes.ts
import { PositionOptionValue } from './global';

// Строго задаём страницы для каждой роли
interface KombainerRoutes {
  index: string;
  create_ticket: string;
  ticket_detail: string;
  qr_code: string;
}

interface VoditelRoutes {
  index: string;
  create_trip: string;
  qr_scanner: string;
}

interface BunkeristRoutes {
  index: string;
  create_ticket: string;
}

interface RolesRoutesMap {
  kombainer: KombainerRoutes;
  voditel: VoditelRoutes;
  bunkerist: BunkeristRoutes;
}

export const Routes = {
  main: '/',
  login: '/login',

  registration: {
    index: '/registration',
    kombainer: 'kombainer',
    voditel: 'voditel',
    bunkerist: 'bunkerist',
  },

  roles: {
    kombainer: {
      index: '/kombainer',
      create_ticket: 'crete-ticket',
      ticket_detail: 'ticket-detail',
      qr_code: 'qr-code',
    },
    voditel: {
      index: '/voditel',
      create_trip: 'crete-ticket',
      qr_scanner: 'qr-scanner',
    },
    bunkerist: {
      index: '/bunkerist',
      create_ticket: 'crete-ticket',
    },
  } as RolesRoutesMap,
};

// Типы для строгой типизации route.role()
type RoleRoutePages<R extends PositionOptionValue> = keyof RolesRoutesMap[R];

// Хелперы с жёсткой типизацией
export const Route = {
  registration: (role: PositionOptionValue) =>
    `${Routes.registration.index}/${Routes.registration[role]}`,

  role: <R extends PositionOptionValue>(role: R, page?: RoleRoutePages<R>) =>
    page ? `${Routes.roles[role].index}/${Routes.roles[role][page]}` : Routes.roles[role].index,
};
