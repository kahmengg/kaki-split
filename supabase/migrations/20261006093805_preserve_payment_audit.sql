-- Payment corrections survive individual deletion; deleting the whole group still
-- cascades its history. Deferred checking lets both group cascades finish first.
alter table public.payment_change_history drop constraint payment_change_history_payment_id_fkey;
alter table public.payment_change_history add constraint payment_change_history_payment_id_fkey
 foreign key(payment_id) references public.payments(id) deferrable initially deferred;
revoke delete on public.payments from authenticated;
