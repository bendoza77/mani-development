-- Russian text for the rows the init migration created: the five built-in pages, the default
-- menu items and the site settings. Each field is filled only while its Russian value is still
-- empty AND its English value is still the original, so nothing the owner has edited since is
-- overwritten, and a translation never describes English text that has since changed.

-- Built-in pages
UPDATE "pages" SET
  "title_ru" = CASE WHEN "title_ru" IS NULL AND "title_en" = 'Private houses, designed and built by one team.' THEN 'Частные дома: проектирует и строит одна команда.' ELSE "title_ru" END,
  "intro_ru" = CASE WHEN "intro_ru" IS NULL AND "intro_en" = 'From steep city plots to vineyard ridges, we plan, engineer and build family homes with one project lead who stays with you from the first footing to handover.' THEN 'От крутых городских участков до виноградных склонов — мы планируем, проектируем и строим семейные дома. Один руководитель проекта ведёт вас от закладки фундамента до сдачи ключей.' ELSE "intro_ru" END,
  "seo_title_ru" = CASE WHEN "seo_title_ru" IS NULL AND "seo_title_en" = 'MANI DEVELOPMENT — Private House Construction' THEN 'MANI DEVELOPMENT — строительство частных домов' ELSE "seo_title_ru" END,
  "seo_description_ru" = CASE WHEN "seo_description_ru" IS NULL AND "seo_description_en" = 'MANI DEVELOPMENT plans, engineers and builds private houses across Georgia, with one accountable team from the first footing to handover.' THEN 'MANI DEVELOPMENT планирует, проектирует и строит частные дома по всей Грузии — одна ответственная команда от фундамента до сдачи ключей.' ELSE "seo_description_ru" END
WHERE "system_key" = 'home';

UPDATE "pages" SET
  "title_ru" = CASE WHEN "title_ru" IS NULL AND "title_en" = 'Private houses, and the rest of our work' THEN 'Частные дома и другие наши работы' ELSE "title_ru" END,
  "intro_ru" = CASE WHEN "intro_ru" IS NULL AND "intro_en" = 'Family houses and villas, alongside the apartment buildings, workplaces and renovations we also build. Completed, on site, and in design.' THEN 'Семейные дома и виллы, а также жилые комплексы, офисные здания и реконструкции, которые мы тоже строим. Завершённые, строящиеся и на стадии проектирования.' ELSE "intro_ru" END,
  "seo_title_ru" = CASE WHEN "seo_title_ru" IS NULL AND "seo_title_en" = 'Projects' THEN 'Проекты' ELSE "seo_title_ru" END,
  "seo_description_ru" = CASE WHEN "seo_description_ru" IS NULL AND "seo_description_en" = 'Private houses, plus apartment, commercial and renovation projects built by MANI DEVELOPMENT across Georgia.' THEN 'Частные дома, а также жилые, коммерческие проекты и реконструкции, построенные MANI DEVELOPMENT по всей Грузии.' ELSE "seo_description_ru" END
WHERE "system_key" = 'projects';

UPDATE "pages" SET
  "title_ru" = CASE WHEN "title_ru" IS NULL AND "title_en" = 'Everything it takes to get your house out of the ground' THEN 'Всё, чтобы ваш дом поднялся из земли' ELSE "title_ru" END,
  "intro_ru" = CASE WHEN "intro_ru" IS NULL AND "intro_en" = 'Planning, engineering and construction under one roof, so the people who plan your house are the same people who build it.' THEN 'Планирование, инженерное проектирование и строительство под одной крышей: ваш дом строят те же люди, которые его спланировали.' ELSE "intro_ru" END,
  "seo_title_ru" = CASE WHEN "seo_title_ru" IS NULL AND "seo_title_en" = 'Services' THEN 'Услуги' ELSE "seo_title_ru" END,
  "seo_description_ru" = CASE WHEN "seo_description_ru" IS NULL AND "seo_description_en" = 'Private house construction, planning, structural engineering, renovation and project management, plus apartment and commercial building. How a project runs, ways to work with us, and common questions.' THEN 'Строительство частных домов, планирование, конструкторское проектирование, реконструкция и управление проектами, а также жилое и коммерческое строительство.' ELSE "seo_description_ru" END
WHERE "system_key" = 'services';

UPDATE "pages" SET
  "title_ru" = CASE WHEN "title_ru" IS NULL AND "title_en" = 'A builder that thinks like an architect' THEN 'Строитель, который мыслит как архитектор' ELSE "title_ru" END,
  "intro_ru" = CASE WHEN "intro_ru" IS NULL AND "intro_en" = 'MANI DEVELOPMENT was founded on a simple idea: buildings turn out better when the people who design them and the people who build them sit at the same table.' THEN 'MANI DEVELOPMENT основана на простой идее: здания получаются лучше, когда те, кто их проектирует, и те, кто их строит, сидят за одним столом.' ELSE "intro_ru" END,
  "seo_title_ru" = CASE WHEN "seo_title_ru" IS NULL AND "seo_title_en" = 'About' THEN 'О компании' ELSE "seo_title_ru" END,
  "seo_description_ru" = CASE WHEN "seo_description_ru" IS NULL AND "seo_description_en" = 'The story, values, standards and people behind MANI DEVELOPMENT, a design-led builder of private houses in Georgia.' THEN 'История, ценности, стандарты и команда MANI DEVELOPMENT — строителя частных домов в Грузии, для которого важен дизайн.' ELSE "seo_description_ru" END
WHERE "system_key" = 'about';

UPDATE "pages" SET
  "title_ru" = CASE WHEN "title_ru" IS NULL AND "title_en" = 'Tell us about your site' THEN 'Расскажите о вашем участке' ELSE "title_ru" END,
  "intro_ru" = CASE WHEN "intro_ru" IS NULL AND "intro_en" = 'A plot, a sketch, a set of drawings or just a question. We read every message and usually reply within two working days.' THEN 'Участок, эскиз, комплект чертежей или просто вопрос. Мы читаем каждое сообщение и обычно отвечаем в течение двух рабочих дней.' ELSE "intro_ru" END,
  "seo_title_ru" = CASE WHEN "seo_title_ru" IS NULL AND "seo_title_en" = 'Contact' THEN 'Контакты' ELSE "seo_title_ru" END,
  "seo_description_ru" = CASE WHEN "seo_description_ru" IS NULL AND "seo_description_en" = 'Start a project with MANI DEVELOPMENT: tell us about your site, sketch or question.' THEN 'Начните проект с MANI DEVELOPMENT: расскажите о вашем участке, эскизе или вопросе.' ELSE "seo_description_ru" END
WHERE "system_key" = 'contact';

-- Default menu items (matched by their original English label)
UPDATE "navigation_items" SET "label_ru" = 'Главная' WHERE "label_ru" IS NULL AND "label_en" = 'Home';
UPDATE "navigation_items" SET "label_ru" = 'Услуги' WHERE "label_ru" IS NULL AND "label_en" = 'Services';
UPDATE "navigation_items" SET "label_ru" = 'Проекты' WHERE "label_ru" IS NULL AND "label_en" = 'Projects';
UPDATE "navigation_items" SET "label_ru" = 'О компании' WHERE "label_ru" IS NULL AND "label_en" = 'About';
UPDATE "navigation_items" SET "label_ru" = 'Контакты' WHERE "label_ru" IS NULL AND "label_en" = 'Contact';

-- Site settings
UPDATE "site_settings" SET
  "tagline_ru" = CASE WHEN "tagline_ru" IS NULL AND "tagline_en" = 'Private house construction' THEN 'Строительство частных домов' ELSE "tagline_ru" END,
  "address_ru" = CASE WHEN "address_ru" IS NULL AND "address_en" = '37m Ilia Chavchavadze Ave, 5th floor, Terminal, Tbilisi' THEN 'просп. Ильи Чавчавадзе, 37м, 5-й этаж, Terminal, Тбилиси' ELSE "address_ru" END,
  "hours_ru" = CASE WHEN "hours_ru" IS NULL AND "hours_en" = 'Mon–Fri, 09:00–18:00' THEN 'Пн–Пт, 09:00–18:00' ELSE "hours_ru" END
WHERE "id" = 1;
