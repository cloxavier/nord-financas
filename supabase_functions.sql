-- Function to permanently delete a treatment and all its related records
-- This is a transactional operation that ensures database integrity.
-- Only users with 'admin' or 'financeiro' roles can execute this.

CREATE OR REPLACE FUNCTION permanently_delete_treatment(p_treatment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
    v_treatment_exists BOOLEAN;
    v_patient_name TEXT;
BEGIN
    -- 1. Validate permissions
    -- Get the role of the current user from the profiles table
    -- auth.uid() is provided by Supabase when called via RPC
    SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
    
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'financeiro') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Permissão negada: Apenas administradores ou financeiro podem excluir tratamentos permanentemente.'
        );
    END IF;

    -- 2. Validate treatment exists and get patient name for the final log
    SELECT EXISTS(SELECT 1 FROM treatments WHERE id = p_treatment_id), patient_name_snapshot 
    INTO v_treatment_exists, v_patient_name
    FROM treatments WHERE id = p_treatment_id;

    IF NOT v_treatment_exists THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Tratamento não encontrado.'
        );
    END IF;

    -- 3. Delete related records that don't have ON DELETE CASCADE or need specific cleanup
    
    -- Delete communication logs linked to installments of this treatment
    DELETE FROM communication_logs 
    WHERE installment_id IN (
        SELECT id FROM installments WHERE treatment_id = p_treatment_id
    );

    -- Delete audit logs specifically tied to this treatment (as requested)
    DELETE FROM audit_logs 
    WHERE entity_id = p_treatment_id AND entity_type = 'treatment';

    -- 4. Delete the treatment itself
    -- The following tables have FOREIGN KEY ... ON DELETE CASCADE:
    -- - treatment_items (treatment_id)
    -- - payment_plans (treatment_id)
    -- - installments (treatment_id)
    -- - payment_records (installment_id -> installments -> treatment_id)
    DELETE FROM treatments WHERE id = p_treatment_id;

    -- 5. Log the permanent deletion action as a general audit log
    -- We use a new entry to record WHO deleted WHAT, even if the original entity is gone.
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description)
    VALUES (
        auth.uid(), 
        'treatment_permanently_deleted', 
        'system', 
        p_treatment_id, 
        'Tratamento permanentemente excluído. Paciente: ' || v_patient_name || ' (ID: ' || p_treatment_id || ')'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Tratamento e todos os registros relacionados foram excluídos com sucesso.'
    );

EXCEPTION WHEN OTHERS THEN
    -- Postgres functions are transactional; any error will rollback the entire operation.
    RETURN jsonb_build_object(
        'success', false, 
        'message', 'Erro durante a exclusão: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
