export type TrainingGoal = "lose" | "health" | "muscle";
export type TrainingExperience = "new" | "returning" | "regular";
export type TrainingLocation = "home" | "home_equipment" | "gym";

export type TrainingProgram = {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  sessionsPerWeek: number;
  duration: string;
  description: string;
  tags: string[];
  sessions: Array<{ title: string; focus: string; exercises: Array<{ name: string; prescription: string; instruction: string }> }>;
};

export const trainingPrograms: TrainingProgram[] = [
  {
    id: "home-start", title: "Старт дома", subtitle: "Мягкое начало без инвентаря", level: "Для новичков", sessionsPerWeek: 3, duration: "20 минут", description: "Полноценные короткие тренировки для привычки двигаться, силы и тонуса.", tags: ["Дом", "Без инвентаря", "Низкая нагрузка"],
    sessions: [
      { title: "Тренировка 1", focus: "Всё тело и техника", exercises: [{ name: "Присед к стулу", prescription: "3 × 10", instruction: "Таз назад, колени направлены по линии носков. При необходимости слегка касайтесь стула." }, { name: "Отжимания от опоры", prescription: "3 × 8", instruction: "Упритесь руками в стол или стену, держите корпус прямым." }, { name: "Ягодичный мост", prescription: "3 × 12", instruction: "Поднимайте таз за счёт ягодиц, не прогибайтесь в пояснице." }, { name: "Планка с колен", prescription: "3 × 20 сек", instruction: "Локти под плечами, живот слегка подтянут, шея расслаблена." }] },
      { title: "Тренировка 2", focus: "Ноги и корпус", exercises: [{ name: "Выпад назад с опорой", prescription: "3 × 8 на сторону", instruction: "Держитесь за стену или стул, шагайте назад коротко и контролируемо." }, { name: "Наклоны «доброе утро»", prescription: "3 × 12", instruction: "Отводите таз назад с ровной спиной, почувствуйте заднюю поверхность бёдер." }, { name: "Птица-собака", prescription: "3 × 8 на сторону", instruction: "Стоя на четвереньках, вытягивайте противоположные руку и ногу без поворота таза." }] },
      { title: "Тренировка 3", focus: "Подвижность и выносливость", exercises: [{ name: "Шаги на месте", prescription: "3 × 60 сек", instruction: "Двигайтесь в комфортном темпе, помогайте руками." }, { name: "Присед к стулу", prescription: "3 × 10", instruction: "Работайте без боли в коленях, контролируйте движение." }, { name: "Мёртвый жук", prescription: "3 × 8 на сторону", instruction: "Прижимайте поясницу к полу и медленно опускайте противоположные руку и ногу." }] },
    ],
  },
  {
    id: "tone-30", title: "Тонус за 30 минут", subtitle: "Сила и выносливость дома", level: "Начальный / средний", sessionsPerWeek: 3, duration: "30 минут", description: "Круговые тренировки для тех, кто уже готов к регулярной нагрузке.", tags: ["Дом", "Тонус", "3 раза в неделю"],
    sessions: [
      { title: "Тренировка 1", focus: "Ноги и ягодицы", exercises: [{ name: "Присед", prescription: "4 × 12", instruction: "Сохраняйте вес на середине стопы, корпус устойчивый." }, { name: "Выпады назад", prescription: "3 × 10 на сторону", instruction: "Отталкивайтесь передней ногой, держите корпус вертикально." }, { name: "Ягодичный мост с паузой", prescription: "4 × 12", instruction: "Задержитесь наверху на одну секунду и сожмите ягодицы." }] },
      { title: "Тренировка 2", focus: "Верх тела и корпус", exercises: [{ name: "Отжимания от опоры", prescription: "4 × 10", instruction: "Выберите высоту опоры, при которой сохраняется техника." }, { name: "Тяга резинки", prescription: "4 × 12", instruction: "Если нет резинки — выполняйте медленные сведения лопаток лёжа." }, { name: "Боковая планка с колен", prescription: "3 × 20 сек на сторону", instruction: "Поднимайте таз, не проваливайтесь в плече." }] },
      { title: "Тренировка 3", focus: "Всё тело", exercises: [{ name: "Присед с темпом", prescription: "3 × 12", instruction: "Опускайтесь на три счёта, поднимайтесь уверенно." }, { name: "Альпинист медленно", prescription: "3 × 30 сек", instruction: "Держите плечи над ладонями, работайте без рывков." }, { name: "Супермен", prescription: "3 × 12", instruction: "Поднимайте грудь и ноги совсем немного, шея продолжает линию спины." }] },
    ],
  },
  {
    id: "gym-strength", title: "Сила в зале", subtitle: "База для набора мышц", level: "Средний", sessionsPerWeek: 3, duration: "45 минут", description: "Три силовые тренировки с основными движениями и понятной прогрессией.", tags: ["Зал", "Сила", "Мышцы"],
    sessions: [
      { title: "Тренировка 1", focus: "Ноги и жим", exercises: [{ name: "Жим ногами", prescription: "4 × 10", instruction: "Опускайте платформу до комфортной глубины, не отрывайте поясницу." }, { name: "Жим гантелей лёжа", prescription: "4 × 10", instruction: "Лопатки сведены, гантели движутся под контролем." }, { name: "Тяга верхнего блока", prescription: "3 × 12", instruction: "Тяните локтями вниз, не раскачивайте корпус." }] },
      { title: "Тренировка 2", focus: "Спина и ягодицы", exercises: [{ name: "Румынская тяга с гантелями", prescription: "4 × 10", instruction: "Гантели близко к ногам, таз уходит назад, спина нейтральна." }, { name: "Тяга горизонтального блока", prescription: "4 × 12", instruction: "Начинайте движение лопатками, затем сгибайте руки." }, { name: "Жим гантелей сидя", prescription: "3 × 10", instruction: "Не прогибайтесь в пояснице, сохраняйте контроль." }] },
      { title: "Тренировка 3", focus: "Всё тело", exercises: [{ name: "Присед с гантелью", prescription: "4 × 12", instruction: "Держите гантель у груди, колени смотрят по направлению носков." }, { name: "Тяга гантели в наклоне", prescription: "3 × 12 на сторону", instruction: "Опирайтесь свободной рукой, не скручивайте корпус." }, { name: "Разгибание спины", prescription: "3 × 12", instruction: "Поднимайтесь до прямой линии корпуса, не переразгибайтесь." }] },
    ],
  },
];

export function recommendProgram(goal: TrainingGoal, experience: TrainingExperience, location: TrainingLocation) {
  if (location === "gym" && (goal === "muscle" || experience === "regular")) return "gym-strength";
  if (experience === "new" || location === "home") return "home-start";
  return "tone-30";
}