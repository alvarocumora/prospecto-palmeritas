DROP TRIGGER IF EXISTS audit_map_annotations ON public.map_annotations;

CREATE TRIGGER audit_map_annotations
AFTER INSERT OR UPDATE OR DELETE ON public.map_annotations
FOR EACH ROW
EXECUTE FUNCTION public.log_audit_change();