import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  FileText,
  Copy,
  Send,
  Eye,
  X,
  Phone,
  MessageCircle,
  CalendarDays,
  ImagePlus,
  Tag,
  ZoomIn,
  Download,
  Palette,
  Sparkles,
  Printer,
} from 'lucide-react';
import {
  Customer,
  CustomerQuote,
  ProductService,
  QuoteItem,
  QuoteStatus,
  QuoteAttachment,
  QuoteTag,
} from '../../types';
import { storageService } from '../../services/storage';
import { formatCurrency } from '../../utils/calculations';
import { CurrencyInput } from '../ui/CurrencyInput';
import { PercentInput } from '../ui/PercentInput';
import { CustomModal } from '../ui/CustomModal';
import { CustomDateInput } from '../ui/CustomDateInput';
import { useToast } from '../ui/Toast';
import { CreateArtPromptModal } from '../art-ai/CreateArtPromptModal';
import { A4PrintPreparationModal } from '../art-ai/A4PrintPreparationModal';
import {
  blobToDataUrl,
  deleteAttachment,
  getAttachment,
  MAX_QUOTE_ATTACHMENTS_SIZE,
  putAttachment,
} from '../../services/attachmentDb';

interface ClientsPageProps {
  products: ProductService[];
  initialCustomerId?: string;
  initialProduct?: ProductService | null;
  onNewQuoteInCalculator?: (customerId?: string) => void;
}

interface CustomerForm {
  id?: string;
  name: string;
  nickname: string;
  phone: string;
  whatsapp: string;
  observations: string;
}

const blankCustomer = (): CustomerForm => ({
  name: '',
  nickname: '',
  phone: '',
  whatsapp: '',
  observations: '',
});

const statusLabels: Record<QuoteStatus, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
};

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function ClientsPage({ products, initialCustomerId, initialProduct, onNewQuoteInCalculator }: ClientsPageProps) {
  const { success, warning } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(() => storageService.getCustomers());
  const [quotes, setQuotes] = useState<CustomerQuote[]>(() => storageService.getQuotes());
  const [tab, setTab] = useState<'clientes' | 'orcamentos'>('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(blankCustomer());
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<CustomerQuote | null>(null);
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false);
  const [quotePreview, setQuotePreview] = useState<CustomerQuote | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [messageEditorOpen, setMessageEditorOpen] = useState(false);

  const [quoteCustomerId, setQuoteCustomerId] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteDiscountPercent, setQuoteDiscountPercent] = useState(0);
  const [quoteDiscountAmount, setQuoteDiscountAmount] = useState(0);
  const [quoteObservations, setQuoteObservations] = useState('');
  const [quoteValidUntil, setQuoteValidUntil] = useState('');
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('pendente');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [quoteTags, setQuoteTags] = useState<QuoteTag[]>(() => storageService.getQuoteTags());
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [quoteAttachments, setQuoteAttachments] = useState<QuoteAttachment[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [expandedAttachment, setExpandedAttachment] = useState<{ metadata: QuoteAttachment; url: string } | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [artPromptModalOpen, setArtPromptModalOpen] = useState(false);
  const [a4Preparation, setA4Preparation] = useState<{ url: string; name: string } | null>(null);
  const [tagForm, setTagForm] = useState<{ id?: string; name: string; color: string }>({ name: '', color: '#db2777' });
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!initialProduct) return;

    const unitPrice = initialProduct.calculationResult?.finalSalePrice || 0;
    const quantity = Math.max(1, initialProduct.sheetCount || 1);
    setTab('orcamentos');
    setEditingQuoteId(null);
    setQuoteCustomerId(initialCustomerId || '');
    setQuoteItems([{
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: initialProduct.id,
      name: initialProduct.name,
      description: initialProduct.description || '',
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice,
    }]);
    setQuoteDiscountPercent(initialProduct.pricing?.discountPercent || 0);
    setQuoteDiscountAmount(0);
    setQuoteObservations(initialProduct.description || '');
    setQuoteValidUntil('');
    setQuoteStatus('pendente');
    setSelectedTagIds([]);
    setQuoteAttachments([]);
    setAttachmentUrls({});
    setQuoteEditorOpen(true);
  }, [initialProduct, initialCustomerId]);

  const filteredCustomers = customers.filter((customer) => {
    const haystack = `${customer.name} ${customer.nickname || ''} ${customer.phone} ${customer.whatsapp}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const filteredQuotes = quotes.filter((quote) => {
    const haystack = `${quote.number} ${quote.customerName} ${quote.status}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const quoteSubtotal = useMemo(
    () => quoteItems.reduce((total, item) => total + Math.max(0, item.subtotal), 0),
    [quoteItems]
  );

  const quoteTotal = useMemo(() => {
    const percentDiscount = quoteSubtotal * (Math.max(0, quoteDiscountPercent) / 100);
    const totalDiscount = percentDiscount + Math.max(0, quoteDiscountAmount);
    return Math.max(0, quoteSubtotal - totalDiscount);
  }, [quoteSubtotal, quoteDiscountPercent, quoteDiscountAmount]);

  const openCustomerModal = (customer?: Customer) => {
    setCustomerForm(customer ? {
      id: customer.id,
      name: customer.name,
      nickname: customer.nickname || '',
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      observations: customer.observations,
    } : blankCustomer());
    setCustomerModalOpen(true);
  };

  const saveCustomer = () => {
    if (!customerForm.name.trim()) {
      warning('Informe o nome', 'O nome do cliente é obrigatório.');
      return;
    }

    const now = new Date().toISOString();
    const customer: Customer = {
      id: customerForm.id || `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: customerForm.name.trim(),
      nickname: customerForm.nickname.trim(),
      phone: customerForm.phone.trim(),
      whatsapp: customerForm.whatsapp.trim() || customerForm.phone.trim(),
      observations: customerForm.observations.trim(),
      createdAt: customerForm.id
        ? customers.find((item) => item.id === customerForm.id)?.createdAt || now
        : now,
      updatedAt: now,
    };

    const updated = storageService.saveCustomer(customer);
    setCustomers(updated);
    setCustomerModalOpen(false);
    success(customerForm.id ? 'Cliente atualizado!' : 'Cliente cadastrado!', `${customer.name} foi salvo localmente.`);
  };

  const confirmDeleteCustomer = () => {
    if (!customerToDelete) return;
    setCustomers(storageService.deleteCustomer(customerToDelete.id));
    setCustomerToDelete(null);
    success('Cliente excluído', 'O cadastro foi removido do dispositivo.');
  };

  const addQuoteItemFromProduct = (product: ProductService) => {
    const unitPrice = product.calculationResult?.finalSalePrice || 0;
    const quantity = Math.max(1, product.sheetCount || 1);
    setQuoteItems((items) => [...items, {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      name: product.name,
      description: product.description || '',
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice,
    }]);
  };

  const addCustomQuoteItem = () => {
    setQuoteItems((items) => [...items, {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    }]);
  };

  const updateQuoteItem = (id: string, updates: Partial<QuoteItem>) => {
    setQuoteItems((items) => items.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      updated.quantity = Math.max(1, Number(updated.quantity) || 1);
      updated.unitPrice = Math.max(0, Number(updated.unitPrice) || 0);
      updated.subtotal = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const removeQuoteItem = (id: string) => {
    setQuoteItems((items) => items.filter((item) => item.id !== id));
  };

  const loadAttachmentUrls = async (attachments: QuoteAttachment[]) => {
    const urls: Record<string, string> = {};
    await Promise.all(attachments.map(async (attachment) => {
      const stored = await getAttachment(attachment.id);
      if (stored) urls[attachment.id] = await blobToDataUrl(stored.blob);
    }));
    setAttachmentUrls(urls);
  };

  const handleAttachmentFiles = async (files: FileList | null, quoteId?: string) => {
    if (!files) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const currentSize = quoteAttachments.reduce((sum, attachment) => sum + attachment.size, 0);
    let incomingSize = 0;

    const additions: QuoteAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        warning('Formato não suportado', 'Use apenas imagens PNG, JPG, JPEG ou WEBP.');
        continue;
      }
      incomingSize += file.size;
      if (currentSize + incomingSize > MAX_QUOTE_ATTACHMENTS_SIZE) {
        warning('Limite de imagens', 'O orçamento pode conter até 30 MB de anexos.');
        break;
      }

      const metadata: QuoteAttachment = {
        id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        description: '',
        createdAt: new Date().toISOString(),
      };

      const targetQuoteId = quoteId || editingQuoteId || `draft-${Date.now()}`;
      const cloudSaved = await putAttachment(targetQuoteId, metadata, file);
      if (!cloudSaved) {
        warning('Imagem salva no cache local', 'A imagem foi mantida neste navegador e será enviada ao Supabase quando houver conexão.');
      }
      additions.push(metadata);
    }

    if (additions.length > 0) {
      const updated = [...quoteAttachments, ...additions];
      setQuoteAttachments(updated);
      await loadAttachmentUrls(updated);
      success('Imagens anexadas', `${additions.length} imagem(ns) adicionada(s) ao orçamento.`);
    }
  };

  const updateAttachmentDescription = (id: string, description: string) => {
    setQuoteAttachments((attachments) => attachments.map((attachment) =>
      attachment.id === id ? { ...attachment, description } : attachment
    ));
  };

  const removeAttachment = async (id: string) => {
    await deleteAttachment(id);
    setQuoteAttachments((attachments) => attachments.filter((attachment) => attachment.id !== id));
    setAttachmentUrls((urls) => {
      const updated = { ...urls };
      delete updated[id];
      return updated;
    });
  };

  const openQuoteEditor = (quote?: CustomerQuote) => {
    setEditingQuoteId(quote?.id || null);
    setQuoteCustomerId(quote?.customerId || '');
    setQuoteItems(quote ? JSON.parse(JSON.stringify(quote.items)) : []);
    setQuoteDiscountPercent(quote?.discountPercent || 0);
    setQuoteDiscountAmount(quote?.discountAmount || 0);
    setQuoteObservations(quote?.observations || '');
    setQuoteValidUntil(quote?.validUntil || '');
    setQuoteStatus(quote?.status || 'pendente');
    setSelectedTagIds(quote?.tagIds || []);
    const attachments = quote?.attachments || [];
    setQuoteAttachments(attachments);
    loadAttachmentUrls(attachments);
    setQuoteEditorOpen(true);
  };

  const buildQuoteMessage = (quote: CustomerQuote) => {
    const client = customers.find((customer) => customer.id === quote.customerId);
    const greetingName = client?.nickname || client?.name || quote.customerName;
    const lines = quote.items.map((item) => `• ${item.quantity}x ${item.name} — ${formatCurrency(item.subtotal)}`);
    return `Olá, ${greetingName}!\n\nSegue seu orçamento preparado pela Kelly Personalizados.\n\n${lines.join('\n')}\n\nValor total: ${formatCurrency(quote.total)}\nValidade do orçamento: ${quote.validUntil ? new Date(`${quote.validUntil}T12:00:00`).toLocaleDateString('pt-BR') : 'a combinar'}\n\n${quote.observations ? `${quote.observations}\n\n` : ''}Qualquer dúvida, estamos à disposição!\n\nKelly Personalizados`;
  };

  const saveQuote = (markStatus?: QuoteStatus) => {
    if (!quoteCustomerId) {
      warning('Selecione o cliente', 'Escolha um cliente cadastrado para criar o orçamento.');
      return;
    }
    if (quoteItems.length === 0) {
      warning('Adicione produtos', 'Inclua pelo menos um produto ou serviço no orçamento.');
      return;
    }

    const customer = customers.find((item) => item.id === quoteCustomerId);
    if (!customer) return;

    const normalizedItems = quoteItems.map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      return { ...item, quantity, unitPrice, subtotal: quantity * unitPrice };
    });

    const subtotal = normalizedItems.reduce((total, item) => total + item.subtotal, 0);
    const amountPercent = subtotal * (quoteDiscountPercent / 100);
    const discountAmount = amountPercent + Math.max(0, quoteDiscountAmount);
    const total = Math.max(0, subtotal - discountAmount);
    const number = editingQuoteId
      ? quotes.find((quote) => quote.id === editingQuoteId)?.number || `ORC-${Date.now().toString().slice(-8)}`
      : `ORC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(quotes.length + 1).padStart(3, '0')}`;

    const quote: CustomerQuote = {
      id: editingQuoteId || `quote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.whatsapp || customer.phone,
      items: normalizedItems,
      subtotal,
      discountPercent: Math.max(0, quoteDiscountPercent),
      discountAmount: Math.max(0, quoteDiscountAmount),
      total,
      observations: quoteObservations.trim(),
      whatsappMessage: '',
      validUntil: quoteValidUntil,
      status: markStatus || quoteStatus,
      attachmentIds: quoteAttachments.map((attachment) => attachment.id),
      attachments: quoteAttachments,
      tagIds: selectedTagIds,
      createdAt: editingQuoteId
        ? quotes.find((item) => item.id === editingQuoteId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    quote.whatsappMessage = buildQuoteMessage(quote);
    const updated = storageService.saveQuote(quote);
    setQuotes(updated);
    setQuoteEditorOpen(false);
    setWhatsappMessage(quote.whatsappMessage);
    setQuotePreview(quote);
    success(editingQuoteId ? 'Orçamento atualizado!' : 'Orçamento criado!', `Número ${quote.number}.`);
  };

  const openQuotePreview = (quote: CustomerQuote) => {
    setWhatsappMessage(quote.whatsappMessage || buildQuoteMessage(quote));
    setQuotePreview(quote);
    loadAttachmentUrls(quote.attachments || []);
  };

  const duplicateQuote = (quote: CustomerQuote) => {
    const duplicate: CustomerQuote = {
      ...JSON.parse(JSON.stringify(quote)),
      id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number: `ORC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(quotes.length + 1).padStart(3, '0')}`,
      status: 'pendente',
      attachmentIds: quote.attachmentIds || quote.attachments?.map((attachment) => attachment.id) || [],
      attachments: quote.attachments || [],
      tagIds: quote.tagIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = storageService.saveQuote(duplicate);
    setQuotes(updated);
    success('Orçamento duplicado!', `${duplicate.number} está pronto para edição.`);
  };

  const updateQuoteStatus = (id: string, status: QuoteStatus) => {
    const quote = quotes.find((item) => item.id === id);
    if (!quote) return;
    const updatedQuote = { ...quote, status, updatedAt: new Date().toISOString() };
    setQuotes(storageService.saveQuote(updatedQuote));
  };

  const confirmDeleteQuote = () => {
    if (!quoteToDelete) return;
    setQuotes(storageService.deleteQuote(quoteToDelete.id));
    setQuoteToDelete(null);
    success('Orçamento excluído', 'O registro foi removido do dispositivo.');
  };

  const downloadQuotePdf = async () => {
    if (!quotePreview) return;

    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = 16;

      pdf.setFillColor(219, 39, 119);
      pdf.rect(0, 0, pageWidth, 22, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('Kelly Personalizados', 14, 14);
      pdf.setFontSize(10);
      pdf.text(`Orçamento ${quotePreview.number}`, pageWidth - 14, 14, { align: 'right' });

      y = 32;
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Dados do cliente', 14, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Cliente: ${quotePreview.customerName}`, 14, y);
      y += 6;
      pdf.text(`Telefone: ${quotePreview.customerPhone || 'Não informado'}`, 14, y);
      y += 6;
      pdf.text(`Data: ${new Date(quotePreview.createdAt).toLocaleDateString('pt-BR')}`, 14, y);
      y += 6;
      pdf.text(`Validade: ${quotePreview.validUntil ? new Date(`${quotePreview.validUntil}T12:00:00`).toLocaleDateString('pt-BR') : 'A combinar'}`, 14, y);

      const selectedTags = (quotePreview.tagIds || [])
        .map((tagId) => quoteTags.find((tag) => tag.id === tagId))
        .filter((tag): tag is QuoteTag => Boolean(tag));

      if (selectedTags.length > 0) {
        y += 9;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Etiquetas:', 14, y);
        y += 6;
        let x = 14;
        selectedTags.forEach((tag) => {
          const hex = tag.color.replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16) || 219;
          const g = parseInt(hex.slice(2, 4), 16) || 39;
          const b = parseInt(hex.slice(4, 6), 16) || 119;
          pdf.setFillColor(r, g, b);
          pdf.roundedRect(x, y - 4, Math.max(24, pdf.getTextWidth(tag.name) + 10), 7, 3, 3, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);
          pdf.text(tag.name, x + 5, y);
          x += Math.max(26, pdf.getTextWidth(tag.name) + 12);
          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(11);
        });
        y += 8;
      }

      y += 5;
      pdf.setFillColor(253, 242, 248);
      pdf.rect(14, y, pageWidth - 28, 9, 'F');
      pdf.setTextColor(157, 23, 77);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('PRODUTO / SERVIÇO', 18, y + 6);
      pdf.text('QTDE', 132, y + 6);
      pdf.text('SUBTOTAL', pageWidth - 18, y + 6, { align: 'right' });
      y += 14;

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      quotePreview.items.forEach((item) => {
        if (y > pageHeight - 35) {
          pdf.addPage();
          y = 16;
        }
        const nameLines = pdf.splitTextToSize(`${item.quantity}x ${item.name}`, 108);
        pdf.text(nameLines, 18, y);
        pdf.text(String(item.quantity), 132, y);
        pdf.text(formatCurrency(item.subtotal), pageWidth - 18, y, { align: 'right' });
        y += Math.max(7, nameLines.length * 4 + 4);
        if (item.description) {
          const descriptionLines = pdf.splitTextToSize(item.description, 108);
          pdf.setTextColor(100, 116, 139);
          pdf.setFontSize(8);
          pdf.text(descriptionLines, 18, y);
          y += Math.max(5, descriptionLines.length * 3.5 + 3);
          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(9);
        }
      });

      y += 5;
      const discount = quotePreview.discountAmount + quotePreview.subtotal * quotePreview.discountPercent / 100;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Subtotal', pageWidth - 66, y);
      pdf.text(formatCurrency(quotePreview.subtotal), pageWidth - 18, y, { align: 'right' });
      y += 6;
      pdf.text('Desconto', pageWidth - 66, y);
      pdf.text(`-${formatCurrency(discount)}`, pageWidth - 18, y, { align: 'right' });
      y += 8;
      pdf.setDrawColor(249, 168, 212);
      pdf.line(pageWidth - 66, y - 4, pageWidth - 18, y - 4);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(219, 39, 119);
      pdf.text('Total', pageWidth - 66, y);
      pdf.text(formatCurrency(quotePreview.total), pageWidth - 18, y, { align: 'right' });

      if (quotePreview.observations) {
        y += 12;
        pdf.setTextColor(51, 65, 85);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Observações:', 14, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        const observations = pdf.splitTextToSize(quotePreview.observations, pageWidth - 28);
        pdf.text(observations, 14, y);
        y += observations.length * 4 + 5;
      }

      const attachments = quotePreview.attachments || [];
      if (attachments.length > 0) {
        if (y > pageHeight - 100) {
          pdf.addPage();
          y = 16;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(157, 23, 77);
        pdf.text('Artes e referências', 14, y);
        y += 8;

        for (let index = 0; index < attachments.length; index += 1) {
          const attachment = attachments[index];
          const stored = await getAttachment(attachment.id);
          if (!stored) continue;

          const dataUrl = await blobToDataUrl(stored.blob);
          const imageSize = await new Promise<{ width: number; height: number }>((resolve) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => resolve({ width: 1, height: 1 });
            image.src = dataUrl;
          });

          const maxWidth = pageWidth - 28;
          const maxHeight = 70;
          const ratio = Math.min(maxWidth / Math.max(1, imageSize.width), maxHeight / Math.max(1, imageSize.height));
          const width = Math.min(maxWidth, imageSize.width * ratio);
          const height = Math.min(maxHeight, imageSize.height * ratio);

          if (y + height + 10 > pageHeight - 14) {
            pdf.addPage();
            y = 16;
          }

          pdf.setDrawColor(251, 207, 232);
          pdf.roundedRect(14, y, pageWidth - 28, height + 12, 3, 3, 'S');
          const x = (pageWidth - width) / 2;
          const format = stored.blob.type === 'image/png' ? 'PNG' : 'JPEG';
          try {
            pdf.addImage(dataUrl, format, x, y + 4, width, height);
          } catch {
            pdf.setTextColor(100, 116, 139);
            pdf.setFontSize(8);
            pdf.text('Imagem não pôde ser incorporada ao PDF.', 18, y + 8);
          }
          y += height + 16;
          if (attachment.description) {
            pdf.setTextColor(71, 85, 105);
            pdf.setFontSize(8);
            const description = pdf.splitTextToSize(attachment.description, pageWidth - 28);
            pdf.text(description, 14, y);
            y += description.length * 3.5 + 5;
          }
        }
      }

      pdf.save(`${quotePreview.number}.pdf`);
      success('PDF gerado!', `O orçamento ${quotePreview.number} foi salvo em PDF.`);
    } catch (error) {
      warning('Não foi possível gerar o PDF', error instanceof Error ? error.message : 'Tente novamente.');
    }
  };

  const shareQuoteFiles = async () => {
    if (!quotePreview) return;
    const storedFiles: File[] = [];

    for (const attachment of quotePreview.attachments || []) {
      const stored = await getAttachment(attachment.id);
      if (stored) {
        storedFiles.push(new File([stored.blob], attachment.name, { type: attachment.type }));
      }
    }

    if (!('share' in navigator) || storedFiles.length === 0) {
      warning('Compartilhamento não disponível', 'Use Baixar orçamento em PDF e anexe o arquivo manualmente no WhatsApp.');
      return;
    }

    try {
      await navigator.share({
        title: `Orçamento ${quotePreview.number}`,
        text: whatsappMessage,
        files: storedFiles,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name !== 'AbortError') {
        warning('Não foi possível compartilhar', 'Use o download do PDF ou selecione a imagem manualmente no WhatsApp.');
      }
    }
  };

  const sendByWhatsApp = () => {
    if (!quotePreview) return;
    const phone = normalizePhone(quotePreview.customerPhone);
    if (!phone) {
      warning('Telefone não informado', 'Cadastre o WhatsApp do cliente antes do envio.');
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    const updatedQuote = { ...quotePreview, status: 'enviado' as QuoteStatus, whatsappMessage, updatedAt: new Date().toISOString() };
    setQuotes(storageService.saveQuote(updatedQuote));
    setQuotePreview(updatedQuote);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pink-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Clientes & Orçamentos</h2>
          <p className="text-xs text-slate-500 mt-1">Cadastre clientes e prepare propostas profissionais para o WhatsApp.</p>
        </div>
        <button
          type="button"
          onClick={() => tab === 'clientes' ? openCustomerModal() : onNewQuoteInCalculator?.()}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md"
        >
          <Plus className="w-4 h-4" />
          {tab === 'clientes' ? 'Novo cliente' : 'Novo orçamento'}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setTab('clientes')} className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap ${tab === 'clientes' ? 'bg-brand-600 text-white' : 'bg-pink-50 text-slate-700 border border-pink-100'}`}>
          Clientes ({customers.length})
        </button>
        <button type="button" onClick={() => setTab('orcamentos')} className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap ${tab === 'orcamentos' ? 'bg-brand-600 text-white' : 'bg-pink-50 text-slate-700 border border-pink-100'}`}>
          Orçamentos ({quotes.length})
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={tab === 'clientes' ? 'Buscar cliente por nome ou telefone...' : 'Buscar orçamento ou cliente...'} className="input-base pl-10" />
      </div>

      {tab === 'clientes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="card-base p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 truncate">{customer.name}</h3>
                  {customer.nickname && <p className="text-xs text-brand-700 mt-0.5">{customer.nickname}</p>}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openCustomerModal(customer)} className="p-2 rounded-lg text-slate-500 hover:bg-pink-50" title="Editar cliente"><Edit3 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setCustomerToDelete(customer)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Excluir cliente"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5">
                {(customer.phone || customer.whatsapp) && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-brand-600" />{customer.whatsapp || customer.phone}</p>}
                {customer.observations && <p className="line-clamp-3 leading-relaxed">{customer.observations}</p>}
              </div>
              <div className="pt-3 border-t border-pink-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{quotes.filter((quote) => quote.customerId === customer.id).length} orçamento(s)</span>
                <button type="button" onClick={() => onNewQuoteInCalculator?.(customer.id)} className="px-3 py-2 rounded-lg bg-pink-50 text-brand-700 border border-pink-100 text-xs font-bold">Novo orçamento</button>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 card-base p-10 text-center"><Users className="w-10 h-10 text-pink-200 mx-auto mb-3" /><p className="font-bold text-slate-700">Nenhum cliente encontrado</p></div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote) => (
            <div key={quote.id} className="card-base p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-900">{quote.number}</h3>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${quote.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : quote.status === 'recusado' ? 'bg-rose-100 text-rose-700' : quote.status === 'enviado' ? 'bg-blue-100 text-blue-700' : 'bg-pink-50 text-brand-700'}`}>{statusLabels[quote.status]}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{quote.customerName} • {quote.items.length} item(ns)</p>
                <p className="text-[11px] text-slate-400 mt-1">Criado em {new Date(quote.createdAt).toLocaleDateString('pt-BR')}{quote.validUntil ? ` • válido até ${new Date(`${quote.validUntil}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}</p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <strong className="text-lg text-brand-700">{formatCurrency(quote.total)}</strong>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openQuotePreview(quote)} className="p-2 rounded-lg text-slate-500 hover:bg-pink-50" title="Visualizar"><Eye className="w-4 h-4" /></button>
                  <button type="button" onClick={() => openQuoteEditor(quote)} className="p-2 rounded-lg text-slate-500 hover:bg-pink-50" title="Editar"><Edit3 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => duplicateQuote(quote)} className="p-2 rounded-lg text-slate-500 hover:bg-pink-50" title="Duplicar"><Copy className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setQuoteToDelete(quote)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <select value={quote.status} onChange={(event) => updateQuoteStatus(quote.id, event.target.value as QuoteStatus)} className="input-base py-2 text-xs sm:w-36">
                {(Object.keys(statusLabels) as QuoteStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </div>
          ))}
          {filteredQuotes.length === 0 && (
            <div className="card-base p-10 text-center"><FileText className="w-10 h-10 text-pink-200 mx-auto mb-3" /><p className="font-bold text-slate-700">Nenhum orçamento encontrado</p></div>
          )}
        </div>
      )}

      <CustomModal isOpen={customerModalOpen} onClose={() => setCustomerModalOpen(false)} title={customerForm.id ? 'Editar cliente' : 'Novo cliente'} confirmText="Salvar cliente" onConfirm={saveCustomer}>
        <div className="space-y-3">
          <div><label className="text-xs font-bold text-slate-700">Nome *</label><input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} className="input-base mt-1" placeholder="Nome do cliente" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-slate-700">Apelido</label><input value={customerForm.nickname} onChange={(event) => setCustomerForm({ ...customerForm, nickname: event.target.value })} className="input-base mt-1" /></div>
            <div><label className="text-xs font-bold text-slate-700">Telefone</label><input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} className="input-base mt-1" inputMode="tel" placeholder="(00) 00000-0000" /></div>
          </div>
          <div><label className="text-xs font-bold text-slate-700">WhatsApp</label><input value={customerForm.whatsapp} onChange={(event) => setCustomerForm({ ...customerForm, whatsapp: event.target.value })} className="input-base mt-1" inputMode="tel" placeholder="55 + DDD + número" /></div>
          <div><label className="text-xs font-bold text-slate-700">Observações</label><textarea value={customerForm.observations} onChange={(event) => setCustomerForm({ ...customerForm, observations: event.target.value })} className="input-base mt-1" rows={3} /></div>
        </div>
      </CustomModal>

      <CustomModal isOpen={!!customerToDelete} onClose={() => setCustomerToDelete(null)} title="Excluir cliente?" description="Os dados do cadastro serão removidos deste dispositivo." confirmText="Excluir" variant="danger" onConfirm={confirmDeleteCustomer} />
      {a4Preparation && (
        <A4PrintPreparationModal
          isOpen={!!a4Preparation}
          onClose={() => setA4Preparation(null)}
          imageUrl={a4Preparation.url}
          fileName={a4Preparation.name}
        />
      )}

      <CreateArtPromptModal isOpen={artPromptModalOpen} onClose={() => setArtPromptModalOpen(false)} />

      {tagEditorOpen && (
        <div className="fixed inset-0 z-[70]">
        <CustomModal
          isOpen={tagEditorOpen}
          onClose={() => setTagEditorOpen(false)}
          title={tagForm.id ? 'Editar etiqueta' : 'Nova etiqueta'}
          confirmText="Salvar etiqueta"
          onConfirm={() => {
            if (!tagForm.name.trim()) {
              warning('Informe o nome', 'Digite um nome para a etiqueta.');
              return;
            }
            const updatedTag: QuoteTag = {
              id: tagForm.id || `tag-custom-${Date.now()}`,
              name: tagForm.name.trim(),
              color: tagForm.color,
              custom: true,
            };
            const updated = tagForm.id
              ? quoteTags.map((tag) => tag.id === tagForm.id ? updatedTag : tag)
              : [...quoteTags, updatedTag];
            setQuoteTags(updated);
            storageService.saveQuoteTags(updated);
            setTagEditorOpen(false);
            success('Etiqueta salva!', updatedTag.name);
          }}
        >
          <div className="space-y-3">
            <div><label className="text-xs font-bold text-slate-700">Nome da etiqueta</label><input value={tagForm.name} onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })} className="input-base mt-1" placeholder="Ex: Para entrega expressa" /></div>
            <div><label className="text-xs font-bold text-slate-700">Cor</label><input type="color" value={tagForm.color} onChange={(event) => setTagForm({ ...tagForm, color: event.target.value })} className="w-full h-11 mt-1 rounded-xl border border-slate-200 p-1 bg-white" /></div>
            {tagForm.id && (
              <button type="button" onClick={() => {
                const updated = quoteTags.filter((tag) => tag.id !== tagForm.id);
                setQuoteTags(updated);
                storageService.saveQuoteTags(updated);
                setSelectedTagIds((ids) => ids.filter((id) => id !== tagForm.id));
                setTagEditorOpen(false);
                success('Etiqueta excluída', 'A etiqueta foi removida.');
              }} className="w-full px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold">Excluir etiqueta personalizada</button>
            )}
          </div>
        </CustomModal>
        </div>
      )}

      {expandedAttachment && (
        <div className="fixed inset-0 z-[70]">
        <CustomModal isOpen={!!expandedAttachment} onClose={() => setExpandedAttachment(null)} title={expandedAttachment.metadata.description || expandedAttachment.metadata.name} cancelText="Fechar" showCancelButton={true}>
          <div className="space-y-3">
            {expandedAttachment.url && <img src={expandedAttachment.url} alt={expandedAttachment.metadata.description || expandedAttachment.metadata.name} className="w-full max-h-[65vh] object-contain rounded-xl bg-slate-50" />}
            {expandedAttachment.url && (
              <button type="button" onClick={() => {
                setA4Preparation({ url: expandedAttachment.url, name: expandedAttachment.metadata.name });
              }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white font-bold text-xs">
                <Printer className="w-4 h-4" /> Preparar para impressão
              </button>
            )}
          </div>
        </CustomModal>
        </div>
      )}

      <CustomModal isOpen={!!quoteToDelete} onClose={() => setQuoteToDelete(null)} title="Excluir orçamento?" description="O orçamento será removido do histórico local." confirmText="Excluir" variant="danger" onConfirm={confirmDeleteQuote} />

      {quoteEditorOpen && (
        <CustomModal isOpen={quoteEditorOpen} onClose={() => setQuoteEditorOpen(false)} title={editingQuoteId ? 'Editar orçamento' : 'Novo orçamento'} onConfirm={() => saveQuote()} confirmText="Salvar orçamento">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-bold text-slate-700">Cliente</label>
              <select value={quoteCustomerId} onChange={(event) => setQuoteCustomerId(event.target.value)} className="input-base mt-1">
                <option value="">Selecione um cliente</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-700">Itens do orçamento</span><button type="button" onClick={addCustomQuoteItem} className="text-xs font-bold text-brand-700">+ Item personalizado</button></div>
              {products.length > 0 && (
                <select onChange={(event) => { const product = products.find((item) => item.id === event.target.value); if (product) addQuoteItemFromProduct(product); event.target.value = ''; }} className="input-base mb-3" defaultValue="">
                  <option value="" disabled>Selecionar serviço cadastrado</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatCurrency(product.calculationResult?.finalSalePrice)}</option>)}
                </select>
              )}

              <div className="space-y-3">
                {quoteItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-pink-100 bg-pink-50/30 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input value={item.name} onChange={(event) => updateQuoteItem(item.id, { name: event.target.value })} placeholder="Nome do produto ou serviço" className="input-base sm:col-span-5" />
                      <input value={item.quantity} onChange={(event) => updateQuoteItem(item.id, { quantity: Number(event.target.value) })} type="number" min={1} className="input-base sm:col-span-2" placeholder="Qtd." />
                      <CurrencyInput value={item.unitPrice} onChange={(value) => updateQuoteItem(item.id, { unitPrice: value })} className="input-base sm:col-span-4" />
                      <button type="button" onClick={() => removeQuoteItem(item.id)} className="sm:col-span-1 p-2 text-rose-500 hover:bg-rose-50 rounded-lg flex justify-center"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <input value={item.description} onChange={(event) => updateQuoteItem(item.id, { description: event.target.value })} placeholder="Descrição opcional" className="input-base" />
                    <div className="text-right text-xs text-slate-600">Subtotal: <strong className="text-slate-900">{formatCurrency(item.subtotal)}</strong></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-pink-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-700">Etiquetas do orçamento</span>
                  <p className="text-[11px] text-slate-400">Selecione uma ou várias etiquetas.</p>
                </div>
                <button type="button" onClick={() => { setTagForm({ name: '', color: '#db2777' }); setTagEditorOpen(true); }} className="text-xs font-bold text-brand-700 px-3 py-2 rounded-lg bg-pink-50 border border-pink-100">
                  + Nova tag
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {quoteTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedTagIds((ids) => selected ? ids.filter((id) => id !== tag.id) : [...ids, tag.id])}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all ${selected ? 'text-white border-transparent shadow-sm' : 'bg-white text-slate-700 border-slate-200'}`}
                      style={selected ? { backgroundColor: tag.color } : undefined}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
              {quoteTags.some((tag) => tag.custom) && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {quoteTags.filter((tag) => tag.custom).map((tag) => (
                    <button key={tag.id} type="button" onClick={() => setTagForm({ id: tag.id, name: tag.name, color: tag.color })} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600">
                      Editar “{tag.name}”
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-pink-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-700">Artes e referências</span>
                  <p className="text-[11px] text-slate-400">PNG, JPG, JPEG ou WEBP. Até 10 MB por imagem.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setArtPromptModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold shadow-sm">
                    <Sparkles className="w-4 h-4" /> Criar arte com IA
                  </button>
                  <button type="button" onClick={() => attachmentInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-50 text-brand-700 border border-pink-100 text-xs font-bold">
                    <ImagePlus className="w-4 h-4" /> Anexar
                  </button>
                </div>
              </div>
              <input ref={attachmentInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => handleAttachmentFiles(event.target.files)} />

              {quoteAttachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {quoteAttachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-xl border border-pink-100 overflow-hidden bg-white">
                      <button type="button" onClick={() => setExpandedAttachment({ metadata: attachment, url: attachmentUrls[attachment.id] })} className="relative w-full h-28 bg-slate-50 block">
                        {attachmentUrls[attachment.id] ? (
                          <img src={attachmentUrls[attachment.id]} alt={attachment.description || attachment.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-slate-400">Carregando...</span>
                        )}
                        <ZoomIn className="w-4 h-4 absolute right-2 bottom-2 p-0.5 rounded bg-white text-slate-600 shadow" />
                      </button>
                      <div className="p-2 space-y-2">
                        <input value={attachment.description} onChange={(event) => updateAttachmentDescription(attachment.id, event.target.value)} placeholder="Descrição da imagem" className="input-base text-xs py-2" />
                        <button type="button" onClick={() => removeAttachment(attachment.id)} className="w-full text-[11px] text-rose-600 font-bold py-1 rounded-lg hover:bg-rose-50">Remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-700">Desconto (%)</label><PercentInput value={quoteDiscountPercent} onChange={(value) => setQuoteDiscountPercent(value || 0)} className="input-base pr-10 mt-1" /></div>
              <div><label className="text-xs font-bold text-slate-700">Desconto (R$)</label><CurrencyInput value={quoteDiscountAmount} onChange={setQuoteDiscountAmount} className="input-base mt-1" /></div>
            </div>

            <CustomDateInput value={quoteValidUntil} onChange={setQuoteValidUntil} placeholder="Validade do orçamento" />

            <div><label className="text-xs font-bold text-slate-700">Observações</label><textarea value={quoteObservations} onChange={(event) => setQuoteObservations(event.target.value)} className="input-base mt-1" rows={3} /></div>

            <div className="p-4 rounded-xl bg-pink-50 border border-pink-100 grid grid-cols-2 gap-3 text-sm">
              <span className="text-slate-600">Subtotal</span><strong className="text-right">{formatCurrency(quoteSubtotal)}</strong>
              <span className="text-slate-600">Descontos</span><strong className="text-right">{formatCurrency((quoteSubtotal * quoteDiscountPercent / 100) + quoteDiscountAmount)}</strong>
              <span className="font-bold text-slate-800">Total</span><strong className="text-right text-brand-700">{formatCurrency(quoteTotal)}</strong>
            </div>
          </div>
        </CustomModal>
      )}

      {quotePreview && (
        <CustomModal isOpen={!!quotePreview} onClose={() => setQuotePreview(null)} title={`Orçamento ${quotePreview.number}`} cancelText="Fechar" showCancelButton={true}>
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            <div className="text-center border-b border-pink-100 pb-4">
              <h3 className="text-xl font-black text-slate-900">Kelly Personalizados</h3>
              <p className="text-xs text-slate-500 mt-1">Orçamento para {quotePreview.customerName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div><span className="block text-slate-400">Número</span><strong className="text-slate-800">{quotePreview.number}</strong></div>
              <div><span className="block text-slate-400">Validade</span><strong className="text-slate-800">{quotePreview.validUntil ? new Date(`${quotePreview.validUntil}T12:00:00`).toLocaleDateString('pt-BR') : 'A combinar'}</strong></div>
              <div><span className="block text-slate-400">Data</span><strong className="text-slate-800">{new Date(quotePreview.createdAt).toLocaleDateString('pt-BR')}</strong></div>
              <div><span className="block text-slate-400">Situação</span><strong className="text-slate-800">{statusLabels[quotePreview.status]}</strong></div>
            </div>
            {quotePreview.tagIds?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quotePreview.tagIds.map((tagId) => {
                  const tag = quoteTags.find((item) => item.id === tagId);
                  return tag ? (
                    <span key={tag.id} className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                  ) : null;
                })}
              </div>
            )}

            {(quotePreview.attachments || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Artes e referências</h4>
                <div className="grid grid-cols-2 gap-3">
                  {(quotePreview.attachments || []).map((attachment) => (
                    <button key={attachment.id} type="button" onClick={() => setExpandedAttachment({ metadata: attachment, url: attachmentUrls[attachment.id] })} className="text-left rounded-xl border border-pink-100 overflow-hidden bg-white">
                      {attachmentUrls[attachment.id] && <img src={attachmentUrls[attachment.id]} alt={attachment.description || attachment.name} className="w-full h-32 object-cover" />}
                      {attachment.description && <p className="p-2 text-[11px] text-slate-600">{attachment.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {quotePreview.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 py-2 border-b border-slate-100 text-xs">
                  <div><strong className="text-slate-800">{item.quantity}x {item.name}</strong>{item.description && <p className="text-slate-500 mt-0.5">{item.description}</p>}</div>
                  <strong className="text-slate-900 shrink-0">{formatCurrency(item.subtotal)}</strong>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-600">Subtotal</span><strong className="text-right">{formatCurrency(quotePreview.subtotal)}</strong>
              <span className="text-slate-600">Desconto</span><strong className="text-right">-{formatCurrency(quotePreview.discountAmount + quotePreview.subtotal * quotePreview.discountPercent / 100)}</strong>
              <span className="font-bold">Total</span><strong className="text-right text-brand-700">{formatCurrency(quotePreview.total)}</strong>
            </div>
            {quotePreview.observations && <p className="text-xs text-slate-600"><strong>Observações:</strong> {quotePreview.observations}</p>}

            <div>
              <label className="text-xs font-bold text-slate-700">Mensagem para WhatsApp</label>
              <textarea value={whatsappMessage} onChange={(event) => setWhatsappMessage(event.target.value)} className="input-base mt-1" rows={7} />
            </div>
            {(quotePreview.attachments || []).length > 0 && (
              <button type="button" onClick={shareQuoteFiles} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs">
                <Send className="w-4 h-4" /> Compartilhar imagens pelo dispositivo
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={downloadQuotePdf} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-pink-200 bg-pink-50 text-brand-700 font-bold text-xs">
                <Download className="w-4 h-4" /> Baixar orçamento em PDF
              </button>
              <button type="button" onClick={sendByWhatsApp} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                <MessageCircle className="w-4 h-4" /> Enviar pelo WhatsApp
              </button>
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
}
