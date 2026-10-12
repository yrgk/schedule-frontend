export type Lesson = Readonly<{
  homework?: readonly string[];
  lessonType?: string;
  room: string;
  teacher: string;
  time: string;
  title: string;
}>;

export type Group = Readonly<{
  id: number;
  name: string;
}>;
