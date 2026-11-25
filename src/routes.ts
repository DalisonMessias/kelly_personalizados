export const STORE_ROUTES = {
  home: '/',
  catalog: '/loja',
  admin: '/admin',
  adminLogin: '/admin/login',
  adminOrders: '/admin/pedidos',
  adminUsers: '/admin/usuarios',
  adminQuoteRequests: '/admin/solicitacoes-orcamento',
  customQuote: '/loja/orcamento-personalizado',
} as const;

export interface StorefrontRoute {
  isProductPage: boolean;
  productId: string | null;
  isOrderPage: boolean;
  orderProductId: string | null;
  isCustomQuotePage: boolean;
  quoteProductId: string | null;
}

export function productDetailPath(name: string, productId: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto';
  return '/loja/produtos/' + slug + '?id=' + encodeURIComponent(productId);
}

export function productOrderPath(productId: string): string {
  return '/loja/pedido/' + encodeURIComponent(productId);
}

export function customQuotePath(productId?: string | null): string {
  return STORE_ROUTES.customQuote + (productId ? '?produto=' + encodeURIComponent(productId) : '');
}

export function resolveStorefrontRoute(pathname: string, search: string): StorefrontRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isProductPage = normalizedPath.startsWith('/loja/produtos/');
  const isOrderPage = normalizedPath.startsWith('/loja/pedido/');
  const isCustomQuotePage = normalizedPath === STORE_ROUTES.customQuote;
  let orderProductId: string | null = null;
  if (isOrderPage) {
    try { orderProductId = decodeURIComponent(normalizedPath.slice('/loja/pedido/'.length)); } catch { orderProductId = null; }
  }
  const params = new URLSearchParams(search);
  return {
    isProductPage,
    productId: isProductPage ? params.get('id') : null,
    isOrderPage,
    orderProductId,
    isCustomQuotePage,
    quoteProductId: isCustomQuotePage ? params.get('produto') : null,
  };
}
