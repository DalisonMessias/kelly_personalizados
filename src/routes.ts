export const STORE_ROUTES = {
  home: '/',
  catalog: '/loja',
  admin: '/admin',
  adminLogin: '/admin/login',
  adminOrders: '/admin/pedidos',
  adminUsers: '/admin/usuarios',
} as const;

export interface StorefrontRoute {
  isProductPage: boolean;
  productId: string | null;
  isOrderPage: boolean;
  orderProductId: string | null;
}

export function productDetailPath(name: string, productId: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto';
  return '/loja/produtos/' + slug + '?id=' + encodeURIComponent(productId);
}

export function productOrderPath(productId: string): string {
  return '/loja/pedido/' + encodeURIComponent(productId);
}

export function resolveStorefrontRoute(pathname: string, search: string): StorefrontRoute {
  const isProductPage = pathname.startsWith('/loja/produtos/');
  const isOrderPage = pathname.startsWith('/loja/pedido/');
  let orderProductId: string | null = null;
  if (isOrderPage) {
    try { orderProductId = decodeURIComponent(pathname.slice('/loja/pedido/'.length)); } catch { orderProductId = null; }
  }
  return { isProductPage, productId: isProductPage ? new URLSearchParams(search).get('id') : null, isOrderPage, orderProductId };
}
