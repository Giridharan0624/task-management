export namespace api {
	
	export class StartTimerData {
	    taskId: string;
	    projectId: string;
	    taskTitle: string;
	    projectName: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new StartTimerData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskId = source["taskId"];
	        this.projectId = source["projectId"];
	        this.taskTitle = source["taskTitle"];
	        this.projectName = source["projectName"];
	        this.description = source["description"];
	    }
	}
	export class Task {
	    taskId: string;
	    projectId: string;
	    title: string;
	    description?: string;
	    status: string;
	    priority: string;
	    domain: string;
	    assignedTo: string[];
	    deadline: string;
	    projectName?: string;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskId = source["taskId"];
	        this.projectId = source["projectId"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.priority = source["priority"];
	        this.domain = source["domain"];
	        this.assignedTo = source["assignedTo"];
	        this.deadline = source["deadline"];
	        this.projectName = source["projectName"];
	    }
	}
	export class User {
	    userId: string;
	    email: string;
	    name: string;
	    systemRole: string;
	    department?: string;
	    avatarUrl?: string;
	    employeeId?: string;
	    skills: string[];
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userId = source["userId"];
	        this.email = source["email"];
	        this.name = source["name"];
	        this.systemRole = source["systemRole"];
	        this.department = source["department"];
	        this.avatarUrl = source["avatarUrl"];
	        this.employeeId = source["employeeId"];
	        this.skills = source["skills"];
	    }
	}

}

export namespace auth {
	
	export class LoginResult {
	    success: boolean;
	    requiresNewPassword: boolean;
	    session?: string;
	    userId?: string;
	    email?: string;
	    name?: string;
	
	    static createFrom(source: any = {}) {
	        return new LoginResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.requiresNewPassword = source["requiresNewPassword"];
	        this.session = source["session"];
	        this.userId = source["userId"];
	        this.email = source["email"];
	        this.name = source["name"];
	    }
	}

}

export namespace state {
	
	export class CurrentTask {
	    taskId: string;
	    projectId: string;
	    taskTitle: string;
	    projectName: string;
	
	    static createFrom(source: any = {}) {
	        return new CurrentTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskId = source["taskId"];
	        this.projectId = source["projectId"];
	        this.taskTitle = source["taskTitle"];
	        this.projectName = source["projectName"];
	    }
	}
	export class AttendanceSession {
	    signInAt: string;
	    signOutAt?: string;
	    hours?: number;
	    taskId?: string;
	    projectId?: string;
	    taskTitle?: string;
	    projectName?: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new AttendanceSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.signInAt = source["signInAt"];
	        this.signOutAt = source["signOutAt"];
	        this.hours = source["hours"];
	        this.taskId = source["taskId"];
	        this.projectId = source["projectId"];
	        this.taskTitle = source["taskTitle"];
	        this.projectName = source["projectName"];
	        this.description = source["description"];
	    }
	}
	export class Attendance {
	    userId: string;
	    date: string;
	    sessions: AttendanceSession[];
	    totalHours: number;
	    currentSignInAt?: string;
	    currentTask?: CurrentTask;
	    userName: string;
	    userEmail: string;
	    systemRole: string;
	    status: string;
	    sessionCount: number;
	
	    static createFrom(source: any = {}) {
	        return new Attendance(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userId = source["userId"];
	        this.date = source["date"];
	        this.sessions = this.convertValues(source["sessions"], AttendanceSession);
	        this.totalHours = source["totalHours"];
	        this.currentSignInAt = source["currentSignInAt"];
	        this.currentTask = this.convertValues(source["currentTask"], CurrentTask);
	        this.userName = source["userName"];
	        this.userEmail = source["userEmail"];
	        this.systemRole = source["systemRole"];
	        this.status = source["status"];
	        this.sessionCount = source["sessionCount"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

