-- Normalize abbreviated genre tags in existing media records
-- and in the genres lookup table

-- Update media.genres arrays: replace abbreviations with full names
update public.media set genres = (
  select array_agg(
    case lower(g)
      when 'z'  then 'Jazz'
      when '4'  then 'Country'
      when '5'  then 'Blues'
      when '6'  then 'Rock'
      when 'x'  then 'NCP'
      when 'ez' then 'Easy Listening'
      when 'u'  then 'Hip Hop'
      when 'm'  then 'Metal'
      when 'r'  then 'Reggae'
      when 'va' then 'Various Artists'
      when 'el' then 'Electronic'
      when 'p'  then 'Pop'
      when 'f'  then 'Folk'
      when 'i'  then 'International'
      else g
    end
  )
  from unnest(genres) as g
)
where genres != '{}';

-- Update the genres table: rename abbreviated entries to full names
-- Delete abbreviation rows that would conflict with existing full-name rows
delete from public.genres
where lower(name) in ('z','4','5','6','x','ez','u','m','r','va','el','p','f','i')
  and exists (
    select 1 from public.genres g2
    where g2.name = case lower(public.genres.name)
      when 'z'  then 'Jazz'
      when '4'  then 'Country'
      when '5'  then 'Blues'
      when '6'  then 'Rock'
      when 'x'  then 'NCP'
      when 'ez' then 'Easy Listening'
      when 'u'  then 'Hip Hop'
      when 'm'  then 'Metal'
      when 'r'  then 'Reggae'
      when 'va' then 'Various Artists'
      when 'el' then 'Electronic'
      when 'p'  then 'Pop'
      when 'f'  then 'Folk'
      when 'i'  then 'International'
    end
  );

-- Rename remaining abbreviation rows to full names
update public.genres set name = case lower(name)
  when 'z'  then 'Jazz'
  when '4'  then 'Country'
  when '5'  then 'Blues'
  when '6'  then 'Rock'
  when 'x'  then 'NCP'
  when 'ez' then 'Easy Listening'
  when 'u'  then 'Hip Hop'
  when 'm'  then 'Metal'
  when 'r'  then 'Reggae'
  when 'va' then 'Various Artists'
  when 'el' then 'Electronic'
  when 'p'  then 'Pop'
  when 'f'  then 'Folk'
  when 'i'  then 'International'
end
where lower(name) in ('z','4','5','6','x','ez','u','m','r','va','el','p','f','i');

-- Ensure all full genre names exist in the genres table
insert into public.genres (name) values
  ('Jazz'), ('Country'), ('Blues'), ('Rock'), ('NCP'),
  ('Easy Listening'), ('Hip Hop'), ('Metal'), ('Reggae'),
  ('Various Artists'), ('Electronic'), ('Pop'), ('Folk'), ('International')
on conflict (name) do nothing;
