export type Lesson = Readonly<{
  room: string;
  teacher: string;
  time: string;
  title: string;
}>;

export type Group = Readonly<{
  id: number;
  name: string;
}>;
