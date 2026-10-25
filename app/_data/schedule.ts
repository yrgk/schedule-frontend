export type Homework = Readonly<{
  id: number;
  text: string;
}>;

export type Lesson = Readonly<{
  homework?: readonly Homework[];
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
