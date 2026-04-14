/**
 * Página de Formulário de Tratamento.
 * Permite a criação de novos tratamentos ou a edição de tratamentos existentes.
 * Gerencia a seleção de pacientes, procedimentos, cálculos financeiros e persistência no banco de dados.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  Search, 
  User, 
  Stethoscope, 
  DollarSign, 
  FileText,
  Calculator,
  UserPlus,
  PlusCircle,
  X
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { logActivity } from '../lib/activities';
import { syncExistingPaymentPlanAfterTreatmentChange } from '../domain/paymentPlans/services/paymentPlanGenerationService';

/**
 * Interface para representar um item de tratamento (procedimento).
 */
interface TreatmentItem {
  id?: string;
  procedure_id: string | null;
  procedure_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  notes: string;
  isManual?: boolean;
}

export default function TreatmentFormPage() {
  // Obtém o ID do tratamento da URL (se estiver editando)
  const { id } = useParams();
  // Obtém parâmetros de busca da URL (ex: patient_id ao iniciar tratamento a partir de um paciente)
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Define se o modo atual é edição ou criação
  const isEdit = Boolean(id);
  const initialPatientId = searchParams.get('patient_id');

  // Estados de controle de interface e carregamento
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Listas de dados para seleção
  const [patients, setPatients] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  
  // Estados para lidar com pacientes inseridos manualmente (sem cadastro prévio)
  const [isManualPatient, setIsManualPatient] = useState(false);
  const [manualPatientData, setManualPatientData] = useState({
    full_name: '',
    phone: '',
    email: ''
  });

  // Estado principal do formulário de tratamento
    const [formData, setFormData] = useState({
    patient_id: initialPatientId || '',
    status: 'draft',
    discount_amount: 0,
    entry_amount: 0,
    payment_method_preference: '',
    notes: ''
  });

  /**
   * Guardamos a base financeira original do plano,
   * ou seja, o saldo realmente parcelável antes da edição.
   */
  const [originalTreatmentFinanceBase, setOriginalTreatmentFinanceBase] = useState<number | null>(null);

  // Lista de itens (procedimentos) incluídos no tratamento
  const [items, setItems] = useState<TreatmentItem[]>([]);
  
  // Estados para controle de modais de seleção
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [savedTreatmentId, setSavedTreatmentId] = useState<string | null>(null);
  const [manualProceduresToSave, setManualProceduresToSave] = useState<TreatmentItem[]>([]);

  // Carrega os dados iniciais ao montar o componente ou mudar o ID
  useEffect(() => {
    fetchInitialData();
  }, [id]);

  /**
   * Busca pacientes, catálogo de procedimentos e dados do tratamento (se for edição).
   */
  async function fetchInitialData() {
    try {
      // Busca pacientes e catálogo de procedimentos em paralelo
      const [patientsRes, proceduresRes] = await Promise.all([
        supabase.from('patients').select('id, full_name, phone, email').order('full_name'),
        supabase.from('procedure_catalog').select('*').eq('is_active', true).order('name')
      ]);

      if (patientsRes.error) throw patientsRes.error;
      if (proceduresRes.error) throw proceduresRes.error;

      setPatients(patientsRes.data || []);
      setProcedures(proceduresRes.data || []);

      // Se for edição, busca os dados do tratamento e seus itens
      if (isEdit && id) {
        const { data: treatment, error: tError } = await supabase
          .from('treatments')
          .select('*')
          .eq('id', id)
          .single();

        if (tError) throw tError;

        if (treatment) {
            setOriginalTreatmentFinanceBase(
            treatment.amount_to_finance ?? treatment.total_amount ?? 0
        );
          // Busca itens do tratamento
          const { data: treatmentItems, error: iError } = await supabase
            .from('treatment_items')
            .select('*')
            .eq('treatment_id', id);

          if (iError) throw iError;

          // Verifica se o paciente foi inserido manualmente (sem ID vinculado)
          if (!treatment.patient_id) {
            setIsManualPatient(true);
            setManualPatientData({
              full_name: treatment.patient_name_snapshot || '',
              phone: treatment.patient_phone_snapshot || '',
              email: treatment.patient_email_snapshot || ''
            });
          }

          // Preenche o estado do formulário com os dados recuperados
            setFormData({
            patient_id: treatment.patient_id || '',
            status: treatment.status,
            discount_amount: treatment.discount_amount || 0,
            entry_amount: treatment.entry_amount || 0,
            payment_method_preference: treatment.payment_method_preference || '',
            notes: treatment.notes || ''
          });

          // Mapeia os itens garantindo que os campos snapshot estejam presentes
          const mappedItems: TreatmentItem[] = (treatmentItems || []).map(item => ({
            id: item.id,
            procedure_id: item.procedure_id,
            procedure_name_snapshot: item.procedure_name_snapshot || item.procedure_name || 'Procedimento',
            unit_price_snapshot: item.unit_price_snapshot || item.unit_price || 0,
            quantity: item.quantity || 1,
            line_total: item.line_total || ((item.unit_price_snapshot || item.unit_price || 0) * (item.quantity || 1)),
            notes: item.notes || '',
            isManual: !item.procedure_id
          }));

          setItems(mappedItems);
        }
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Adiciona um item (procedimento) à lista de itens do tratamento.
   * @param procedureId ID do procedimento do catálogo (opcional para itens manuais)
   */
  const addItem = (procedureId?: string) => {
    if (procedureId) {
      // Busca o procedimento no catálogo
      const procedure = procedures.find(p => p.id === procedureId);
      if (!procedure) return;

      // Cria um novo item baseado no catálogo
      const newItem: TreatmentItem = {
        procedure_id: procedure.id,
        procedure_name_snapshot: procedure.name,
        unit_price_snapshot: procedure.default_price,
        quantity: 1,
        line_total: procedure.default_price,
        notes: ''
      };
      setItems([...items, newItem]);
    } else {
      // Cria um item manual (sem vínculo com o catálogo)
      const newItem: TreatmentItem = {
        procedure_id: null,
        procedure_name_snapshot: '',
        unit_price_snapshot: 0,
        quantity: 1,
        line_total: 0,
        notes: '',
        isManual: true
      };
      setItems([...items, newItem]);
    }
  };

  /**
   * Remove um item da lista de itens pelo índice.
   * @param index Índice do item a ser removido
   */
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  /**
   * Atualiza os dados de um item específico e recalcula o total da linha.
   * @param index Índice do item
   * @param updates Objeto com as atualizações
   */
  const updateItem = (index: number, updates: Partial<TreatmentItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    newItems[index].line_total = newItems[index].unit_price_snapshot * newItems[index].quantity;
    setItems(newItems);
  };

  // Cálculos financeiros derivados do estado dos itens e do formulário
    /**
   * Base financeira do tratamento nesta fase:
   * - subtotal: soma dos procedimentos
   * - contractedTotal: total contratado após desconto
   * - entryAmount: entrada negociada
   * - amountToFinance: saldo usado como base do parcelamento
   */
  const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountAmount = Math.max(0, Number(formData.discount_amount || 0));
  const contractedTotal = Math.max(0, subtotal - discountAmount);
  const entryAmount = Math.max(0, Number(formData.entry_amount || 0));
  const amountToFinance = Math.max(0, contractedTotal - entryAmount);

  /**
   * Lida com a submissão do formulário (Criação ou Edição).
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas de preenchimento
    if (!isManualPatient && !formData.patient_id) return alert('Selecione um paciente.');
    if (isManualPatient && !manualPatientData.full_name) return alert('Informe o nome do paciente.');
    if (items.length === 0) return alert('Adicione pelo menos um procedimento.');
    
    // Valida se todos os itens manuais possuem nome e valor válido
    const invalidItem = items.find(item => !item.procedure_name_snapshot || item.unit_price_snapshot <= 0);
    if (invalidItem) return alert('Todos os procedimentos devem ter nome e valor maior que zero.');

    if (discountAmount > subtotal) {
      return alert('O desconto não pode ser maior que o subtotal.');
    }

    if (entryAmount > contractedTotal) {
      return alert('A entrada não pode ser maior que o valor total do tratamento.');
    }

    setSaving(true);
    
    // Define os dados do paciente que serão salvos como snapshot no tratamento
    let patientName = '';
    let patientPhone = '';
    let patientEmail = '';

    if (isManualPatient) {
      patientName = manualPatientData.full_name;
      patientPhone = manualPatientData.phone;
      patientEmail = manualPatientData.email;
    } else {
      const selectedPatient = patients.find(p => p.id === formData.patient_id);
      patientName = selectedPatient.full_name;
      patientPhone = selectedPatient.phone;
      patientEmail = selectedPatient.email;
    }

    try {
      // Prepara o objeto de dados do tratamento para salvar
        const treatmentData: any = {
        ...formData,
        patient_id: isManualPatient ? null : formData.patient_id,
        patient_name_snapshot: patientName,
        patient_phone_snapshot: patientPhone,
        patient_email_snapshot: patientEmail,
        discount_amount: discountAmount,
        entry_amount: entryAmount,
        subtotal,
        total_amount: contractedTotal,
        amount_to_finance: amountToFinance,
        updated_at: new Date().toISOString()
      };

      let treatmentId = id;

      if (isEdit && id) {
        // Atualiza o tratamento existente
        const { error: updateError } = await supabase
          .from('treatments')
          .update(treatmentData)
          .eq('id', id);

        if (updateError) throw updateError;
        
        // Remove os itens antigos para reinserir os novos (estratégia de sincronização simples)
        const { error: deleteError } = await supabase
          .from('treatment_items')
          .delete()
          .eq('treatment_id', id);

        if (deleteError) throw deleteError;
      } else {
        // Insere um novo tratamento
        const { data: newTreatment, error: insertError } = await supabase
          .from('treatments')
          .insert([{ 
            ...treatmentData, 
            created_at: new Date().toISOString() 
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        treatmentId = newTreatment.id;
        
        // Registra a atividade de criação
                await logActivity(
          'treatment_created',
          `Tratamento para ${patientName} criado no valor de ${formatCurrency(contractedTotal)}`,
          { entity_id: treatmentId }
        );
      }

      // Prepara e insere os itens do tratamento
      const itemsToInsert = items.map(item => ({
        treatment_id: treatmentId,
        procedure_id: item.procedure_id || null,
        procedure_name_snapshot: item.procedure_name_snapshot || 'Procedimento',
        unit_price_snapshot: item.unit_price_snapshot || 0,
        quantity: item.quantity || 1,
        line_total: (item.unit_price_snapshot || 0) * (item.quantity || 1),
        notes: item.notes || ''
      }));

      const { error: itemsError } = await supabase
        .from('treatment_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      let paymentPlanSyncMessage: string | null = null;

      if (isEdit && treatmentId && originalTreatmentFinanceBase !== null) {
        const financeBaseChanged =
          Math.abs(amountToFinance - originalTreatmentFinanceBase) > 0.009;

        if (financeBaseChanged) {
          const syncResult = await syncExistingPaymentPlanAfterTreatmentChange({
            treatmentId,
            amountToFinance,
          });

          if (syncResult.status === 'blocked') {
            paymentPlanSyncMessage =
              syncResult.message ||
              'Tratamento salvo, mas o plano não foi recalculado automaticamente.';
          }

          if (syncResult.status === 'synced') {
            await logActivity(
              'payment_plan_synced',
              `Plano de pagamento do tratamento #${treatmentId.slice(0, 8)} recalculado após edição do valor total.`,
              { entity_id: treatmentId }
            );
          }
        }
      }
      

      // Verifica se há dados manuais (paciente ou procedimentos) que o usuário pode querer salvar no catálogo
      const manualProcs = items.filter(item => !item.procedure_id);
      
      if (paymentPlanSyncMessage) {
  alert(paymentPlanSyncMessage);
}

      if (isManualPatient || manualProcs.length > 0) {
        setSavedTreatmentId(treatmentId);
        setManualProceduresToSave(manualProcs);
        
        // Exibe modais de sugestão de salvamento no catálogo
        if (isManualPatient) {
          setShowPatientModal(true);
        } else if (manualProcs.length > 0) {
          setShowProcedureModal(true);
        } else {
          navigate(`/tratamentos/${treatmentId}`);
        }
      } else {
        // Se tudo estiver vinculado ao catálogo, redireciona para os detalhes
        navigate(`/tratamentos/${treatmentId}`);
      }
    } catch (error: any) {
      console.error('Error saving treatment:', error);
      alert(error.message || 'Erro ao salvar tratamento.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Salva o paciente inserido manualmente no catálogo de pacientes.
   */
  const handleSavePatientToCatalog = async () => {
    try {
      const { error } = await supabase.from('patients').insert([{
        full_name: manualPatientData.full_name,
        phone: manualPatientData.phone,
        email: manualPatientData.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      if (error) throw error;
      
      setShowPatientModal(false);
      // Se houver procedimentos manuais, mostra o próximo modal, senão redireciona
      if (manualProceduresToSave.length > 0) {
        setShowProcedureModal(true);
      } else {
        navigate(`/tratamentos/${savedTreatmentId}`);
      }
    } catch (error) {
      console.error('Error saving patient to catalog:', error);
      alert('Erro ao salvar paciente no catálogo.');
    }
  };

  /**
   * Salva os procedimentos inseridos manualmente no catálogo de procedimentos.
   */
  const handleSaveProceduresToCatalog = async () => {
    try {
      const proceduresToInsert = manualProceduresToSave.map(p => ({
        name: p.procedure_name_snapshot,
        default_price: p.unit_price_snapshot,
        category: 'Geral',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('procedure_catalog').insert(proceduresToInsert);
      if (error) throw error;
      
      setShowProcedureModal(false);
      navigate(`/tratamentos/${savedTreatmentId}`);
    } catch (error) {
      console.error('Error saving procedures to catalog:', error);
      alert('Erro ao salvar procedimentos no catálogo.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar Tratamento' : 'Novo Tratamento'}</h1>
          <p className="text-sm text-gray-500">Crie orçamentos e planeje os procedimentos do paciente.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <div className="flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                <h3 className="font-bold text-gray-900">Paciente</h3>
              </div>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsManualPatient(false)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!isManualPatient ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Registrado
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualPatient(true)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isManualPatient ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Manual
                </button>
              </div>
            </div>

            {!isManualPatient ? (
              <select
                required={!isManualPatient}
                value={formData.patient_id ?? ''}
                onChange={e => setFormData({...formData, patient_id: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Selecione o paciente</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required={isManualPatient}
                    value={manualPatientData.full_name ?? ''}
                    onChange={e => setManualPatientData({...manualPatientData, full_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Nome do paciente"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={manualPatientData.phone ?? ''}
                    onChange={e => setManualPatientData({...manualPatientData, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">E-mail</label>
                  <input
                    type="email"
                    value={manualPatientData.email ?? ''}
                    onChange={e => setManualPatientData({...manualPatientData, email: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Procedures Selection */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-blue-600" />
                <h3 className="font-bold text-gray-900">Procedimentos</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        addItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none"
                  >
                    <option value="">Buscar no catálogo...</option>
                    {procedures.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.default_price)}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => addItem()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                >
                  <PlusCircle size={14} />
                  <span>Manual</span>
                </button>
              </div>
            </div>
            
            <div className="divide-y">
              {items.length > 0 ? items.map((item, idx) => (
                <div key={idx} className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-3">
                      {item.procedure_id ? (
                        <div>
                          <p className="font-bold text-gray-900">{item.procedure_name_snapshot}</p>
                          <p className="text-xs text-gray-500">Catálogo: {procedures.find(p => p.id === item.procedure_id)?.category || 'Geral'}</p>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Procedimento *</label>
                          <input
                            type="text"
                            required
                            value={item.procedure_name_snapshot ?? ''}
                            onChange={e => updateItem(idx, { procedure_name_snapshot: e.target.value })}
                            className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                            placeholder="Nome do procedimento manual"
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor Unitário *</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item.unit_price_snapshot ?? ''}
                              onChange={e => updateItem(idx, { unit_price_snapshot: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-7 pr-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Quantidade</label>
                          <div className="flex items-center border rounded-lg overflow-hidden">
                            <button 
                              type="button"
                              onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
                              className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              value={item.quantity ?? ''}
                              onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                              className="w-10 text-center text-xs font-bold border-x outline-none py-1"
                            />
                            <button 
                              type="button"
                              onClick={() => updateItem(idx, { quantity: item.quantity + 1 })}
                              className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="hidden sm:block">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Total</label>
                          <p className="py-1.5 text-sm font-bold text-gray-900">{formatCurrency(item.line_total)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2">
                      <div className="sm:hidden">
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(item.line_total)}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors bg-gray-50 sm:bg-transparent rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={item.notes ?? ''}
                      onChange={e => updateItem(idx, { notes: e.target.value })}
                      className="w-full px-3 py-1.5 border border-dashed rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                      placeholder="Observações deste item..."
                    />
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center">
                  <p className="text-gray-500">Nenhum procedimento adicionado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <FileText size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Observações do Tratamento</h3>
            </div>
            <textarea
              rows={4}
              value={formData.notes ?? ''}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Detalhes sobre o plano de tratamento, prazos ou condições especiais..."
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-xl border shadow-sm p-6 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <Calculator size={18} className="text-blue-600" />
              Resumo Financeiro
            </h3>
                        <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_amount ?? ''}
                  onChange={e => setFormData({...formData, discount_amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold"
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-500">Total Contratado</span>
                <span className="font-bold text-gray-900">{formatCurrency(contractedTotal)}</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Entrada (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.entry_amount ?? ''}
                  onChange={e => setFormData({...formData, entry_amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold"
                />
                <p className="text-[11px] text-gray-400">
                  Nesta fase, a entrada é contratual e reduz o saldo do parcelamento.
                </p>
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-900 block">Saldo a Parcelar</span>
                  <span className="text-[11px] text-gray-400">
                    Base usada para gerar as parcelas
                  </span>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(amountToFinance)}
                </span>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={formData.status ?? 'draft'}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold"
                >
                  <option value="draft">Orçamento (Rascunho)</option>
                  <option value="pending">Aguardando Aprovação</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preferência de Pagamento</label>
                <input
                  type="text"
                  value={formData.payment_method_preference ?? ''}
                  onChange={e => setFormData({...formData, payment_method_preference: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Ex: Cartão 10x, PIX..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-8 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save size={20} />}
              <span>{isEdit ? 'Salvar Alterações' : 'Gerar Orçamento'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Patient Save Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <UserPlus size={24} />
              <h3 className="text-xl font-bold">Salvar Paciente?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Você usou um paciente manual (<strong>{manualPatientData.full_name}</strong>). Deseja salvá-lo na sua base de pacientes para usos futuros?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSavePatientToCatalog}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Sim, salvar paciente
              </button>
              <button
                onClick={() => {
                  setShowPatientModal(false);
                  if (manualProceduresToSave.length > 0) {
                    setShowProcedureModal(true);
                  } else {
                    navigate(`/tratamentos/${savedTreatmentId}`);
                  }
                }}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Não, apenas salvar tratamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Procedure Save Modal */}
      {showProcedureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <PlusCircle size={24} />
              <h3 className="text-xl font-bold">Salvar Procedimentos?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Você adicionou {manualProceduresToSave.length} procedimento(s) manual(is). Deseja salvá-los no seu catálogo para facilitar orçamentos futuros?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveProceduresToCatalog}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Sim, salvar no catálogo
              </button>
              <button
                onClick={() => {
                  setShowProcedureModal(false);
                  navigate(`/tratamentos/${savedTreatmentId}`);
                }}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Não, apenas salvar tratamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
