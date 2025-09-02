import { defineStore } from "pinia";

// Definimos los tipos para mejor autocompletado y seguridad
interface Task {
  id: number;
  title: string;
  completed: boolean;
}

type TaskStoreState = {
  tasks: Task[];
  progress: number;
  isLoading: boolean;
  error: string | null;
};

export const useTaskStore = defineStore('tasks', {
  state: (): TaskStoreState => ({
    tasks: [],
    progress: 42,
    isLoading: false,
    error: null
  }),

  getters: {
    completedTasks: (state) => state.tasks.filter(task => task.completed),
    pendingTasks: (state) => state.tasks.filter(task => !task.completed),
    progressPercentage: (state) => `${state.progress}%`,
    totalTasks: (state) => state.tasks.length
  },

  actions: {
    async loadTasks() {
      this.isLoading = true;
      this.error = null;

      try {
        // Simulación de llamada API
        const mockTasks: Task[] = [
          { id: 1, title: 'Aprender Pinia', completed: true },
          { id: 2, title: 'Crear store de tareas', completed: false },
          { id: 3, title: 'Implementar acciones', completed: false },
          { id: 4, title: 'Probar getters', completed: false }
        ];

        // Simulamos un retraso de red
        await new Promise(resolve => setTimeout(resolve, 800));

        this.tasks = mockTasks;
        this.updateProgress();
      } catch (error) {
        this.error = 'Error al cargar las tareas';
        console.error('Error loading tasks:', error);
      } finally {
        this.isLoading = false;
      }
    },

    addTask(title: string) {
      const newTask: Task = {
        id: Date.now(), // ID temporal
        title,
        completed: false
      };

      this.tasks.unshift(newTask);
      this.updateProgress();
    },

    toggleTask(id: number) {
      const task = this.tasks.find(task => task.id === id);
      if (task) {
        task.completed = !task.completed;
        this.updateProgress();
      }
    },

    deleteTask(id: number) {
      this.tasks = this.tasks.filter(task => task.id !== id);
      this.updateProgress();
    },

    updateProgress() {
      if (this.tasks.length === 0) {
        this.progress = 0;
        return;
      }

      const completed = this.tasks.filter(task => task.completed).length;
      this.progress = Math.round((completed / this.tasks.length) * 100);
    },

    resetTasks() {
      this.tasks = [];
      this.progress = 0;
    }
  }
});