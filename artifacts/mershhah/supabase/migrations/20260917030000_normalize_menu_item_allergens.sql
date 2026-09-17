-- menu_items.allergens is meant to hold a fixed set of ids (nuts, milk,
-- eggs, wheat, fish, shellfish, soy, sesame, gluten - see
-- src/lib/allergens.ts's ALLERGEN_META), each resolved to a label via
-- t(labelKey) so it renders in Arabic or English correctly. Some existing
-- items have the Arabic label text saved directly instead (e.g. "غلوتين"
-- instead of "gluten") - a format drift from before the picker settled on
-- ids - which every reader (the owner's own edit dialog, the AI dashboard
-- assistant, and the new public-menu allergen badges) silently fails to
-- recognize, since none of them match any ALLERGEN_META id.
--
-- Normalizes every array to ids and de-duplicates (a few items ended up
-- with both the old Arabic text and the new id for the same allergen,
-- e.g. ["غلوتين","حليب","milk","wheat"]).
update public.menu_items
set allergens = (
  select coalesce(jsonb_agg(distinct mapped), '[]'::jsonb)
  from (
    select case elem
      when 'مكسرات' then 'nuts'
      when 'حليب' then 'milk'
      when 'بيض' then 'eggs'
      when 'قمح' then 'wheat'
      when 'سمك' then 'fish'
      when 'محار' then 'shellfish'
      when 'فول الصويا' then 'soy'
      when 'سمسم' then 'sesame'
      when 'غلوتين' then 'gluten'
      else elem
    end as mapped
    from jsonb_array_elements_text(allergens) as elem
  ) t
)
where allergens is not null and jsonb_array_length(allergens) > 0;

-- Verification - any row here has an allergen value that isn't one of the
-- 9 known ids and wasn't one of the known Arabic labels above either, so
-- it still won't render on the public menu or in the owner's picker.
select m.id, m.name, m.allergens
from public.menu_items m, jsonb_array_elements_text(m.allergens) as elem
where elem not in ('nuts', 'milk', 'eggs', 'wheat', 'fish', 'shellfish', 'soy', 'sesame', 'gluten');
