
/**
 * Página de Formulário de Paciente.
 * Permite o cadastro de novos pacientes ou a edição de pacientes existentes.
 *
 * Nesta etapa:
 * - estrutura o telefone em país + DDD + número
 * - mantém compatibilidade com o campo legado "phone"
 * - deixa o país pré-preenchido conforme a localidade do navegador
 * - mantém DDD e número sempre editáveis
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  buildPhoneStorageValue,
  formatDateOnlyForInput,
  getDefaultCountryCodeForLocale,
  getPhonePartsFromPatient,
  normalizeAreaCode,
  normalizeCountryCode,
  normalizePhoneNumber,
  PHONE_COUNTRY_OPTIONS,
} from '../lib/utils';

interface PatientFormState {
  full_name: string;
  cpf: string;
  phone_country_code: string;
  phone_area_code: string;
  phone_number: string;
  email: string;
  birth_date: string;
  address: string;
  notes: string;
}

function createEmptyForm(defaultCountryCode: string): PatientFormState {
  return {
    full_name: '',
    cpf: '',
    phone_country_code: defaultCountryCode,
    phone_area_code: '',
    phone_number: '',
    email: '',
    birth_date: '',
    address: '',
    notes: '',
  };
}

export default function PatientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const defaultCountryCode = useMemo(() => getDefaultCountryCodeForLocale(), []);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<PatientFormState>(() =>
    createEmptyForm(defaultCountryCode)
  );

  useEffect(() => {
    if (isEdit) {
      fetchPatient();
      return;
    }

    setLoading(false);
  }, [id]);

  function updateField<K extends keyof PatientFormState>(field: K, value: PatientFormState[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function fetchPatient() {
    if (!id) return;

    try {
      const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
      if (error) throw error;

      if (data) {
        const phoneParts = getPhonePartsFromPatient(data);

        setFormData({
          full_name: data.full_name || '',
          cpf: data.cpf || '',
          phone_country_code: phoneParts.countryCode || defaultCountryCode,
          phone_area_code: phoneParts.areaCode || '',
          phone_number: phoneParts.number || '',
          email: data.email || '',
          birth_date: formatDateOnlyForInput(data.birth_date),
          address: data.address || '',
          notes: data.notes || '',
        });
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
      alert('Erro ao carregar paciente.');
      navigate('/pacientes');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const phone_country_code = normalizeCountryCode(formData.phone_country_code);
      const phone_area_code = normalizeAreaCode(formData.phone_area_code);
      const phone_number = normalizePhoneNumber(formData.phone_number);

      const dataToSave = {
        full_name: formData.full_name.trim(),
        cpf: formData.cpf.trim() || null,
        phone_country_code: phone_country_code || null,
        phone_area_code: phone_area_code || null,
        phone_number: phone_number || null,
        phone:
          buildPhoneStorageValue({
            countryCode: phone_country_code,
            areaCode: phone_area_code,
            number: phone_number,
          }) || null,
        email: formData.email.trim() || null,
        birth_date: formData.birth_date || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && id) {
        const { error } = await supabase.from('patients').update(dataToSave).eq('id', id);
        if (error) throw error;

        const { logActivity } = await import('../lib/activities');
        await logActivity('patient_updated', `Dados do paciente ${formData.full_name} atualizados`, {
          entity_id: id,
        });

        navigate(`/pacientes/${id}`);
      } else {
        const { data, error } = await supabase
          .from('patients')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const { logActivity } = await import('../lib/activities');
          await logActivity('patient_created', `Paciente ${formData.full_name} cadastrado`, {
            entity_id: data.id,
          });

          navigate(`/pacientes/${data.id}`);
        }
      }
    } catch (error: any) {
      console.error('Error saving patient:', error);
      alert(error.message || 'Erro ao salvar paciente.');
    } finally {
      setSaving(false);
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
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          type="button"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Editar Paciente' : 'Novo Paciente'}
          </h1>
          <p className="text-sm text-gray-500">Preencha os dados cadastrais do paciente.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <User size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Informações Pessoais</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nome completo do paciente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => updateField('cpf', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="date"
                    value={formatDateOnlyForInput(formData.birth_date)}
                    onChange={(e) => updateField('birth_date', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Phone size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Contato e Endereço</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1.4fr,0.9fr,1.7fr] gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Código do país
                      </label>
                      <select
                        value={formData.phone_country_code}
                        onChange={(e) =>
                          updateField('phone_country_code', normalizeCountryCode(e.target.value))
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        {PHONE_COUNTRY_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        DDD / Área
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={formData.phone_area_code}
                        onChange={(e) =>
                          updateField('phone_area_code', normalizeAreaCode(e.target.value))
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="21"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Número
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={formData.phone_number}
                        onChange={(e) =>
                          updateField('phone_number', normalizePhoneNumber(e.target.value))
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="999990000"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 leading-5">
                    O país vem sugerido automaticamente conforme a localidade do navegador, mas pode ser alterado.
                    O DDD fica livre para edição porque nem sempre é o mesmo da clínica.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Rua, número, bairro, cidade - UF"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <FileText size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Observações Adicionais</h3>
            </div>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Alergias, histórico médico, observações financeiras..."
            />
          </section>
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={18} />}
            <span>{isEdit ? 'Salvar Alterações' : 'Cadastrar Paciente'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
