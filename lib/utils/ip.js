export default {
    occupiedIps: [],
    ip: 3000,
    start: (ip) =>{
        this.ip = ip;
    },
    next: () => {
        //TODO: check for ip conflicts
        this.ip++;
        this.occupiedIps.push(this.ip);

        return this.ip;
    }
}