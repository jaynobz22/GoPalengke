-- Auto-deduct product stock per ordered item; restore when order is cancelled.
create or replace function public.deduct_product_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update products
       set stock = greatest(0, stock - ceil(coalesce(new.quantity, 0))::int),
           updated_at = now()
     where id = new.product_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_deduct_product_stock on public.order_items;
create trigger trg_deduct_product_stock after insert on public.order_items
for each row execute function public.deduct_product_stock();

create or replace function public.restore_product_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update products p
       set stock = p.stock + ceil(oi.quantity)::int, updated_at = now()
      from order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_restore_product_stock on public.orders;
create trigger trg_restore_product_stock after update of status on public.orders
for each row execute function public.restore_product_stock();
