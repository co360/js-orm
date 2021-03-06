/**
 * Giao tiếp csdl tự động, sử dụng chung các mệnh đề insertOne, updateWhere, selectOne, selectAll, deleteOne
 * Giao tiếp các phương thức để: Tạo bảng - tương đương một model cho phép:
 * - tìm bảng ghi (s) = selectOne / selectAll,
 * - chèn bảng ghi = insertOne,
 * - update bảng ghi = updateWhere,
 * - và delete bảng ghi = deleteOne
 * Kết nối với csdl, trả kết nối
 *
 */

var SQLiteDAO = require("./sqlite-dao"),
  OracleDAO = require("./oracle-dao"),
  MongoDAO = require("./mongo-dao");

// nếu không khai chuỗi kết nối thì nó tự tạo ra chuỗi default là sqlite3
let defaultCfg = {
  type: "sqlite3", //  "mongodb" | "oracle" | "sqlite3"
  isDebug: true,
  database: "../db/database/node-js-orm-demo-sqlite3.db",
  // phần giành cho các csdl có xác thực
  hosts: [{ host: "localhost", port: 8080 }],
  username: "test",
  password: "test123",
  // phần giành cho oracle database thêm
  pool: {
    name: "Node-Orm-Pool",
    max: 2,
    min: 2,
    increment: 0,
    idle: 10000,
    timeout: 4,
  },
  // phần giành cho mongodb thêm
  repSet: "rs0", // Khai báo bộ db replicate
  isRoot: true, // nếu user của mongo có quyền root t
  // tham số phụ thêm vào để xác định csdl có hỗ trợ tự tạo auto_increment không?
  // nếu csdl nào không hổ trợ thì tắt nó đi và sử dụng mô hình model để tạo id tự động
  auto_increment_support: true,
};

class NodeDatabase {
  /**
   * @param {*} connCfg
  type: "oracle", //  "mongodb" | "oracle" | "sqlite3"
  isDebug: true,
  database: "demo",
  // phần giành cho các csdl có xác thực
  hosts: [
    { host: "localhost", port: 27019 },
    { host: "localhost", port: 27018 },
  ],
  username: "demo",
  password: "123",
  // phần giành cho oracle database thêm
  pool: {
    name: "Node-Orm-Pool",
    max: 2,
    min: 2,
    increment: 0,
    idle: 10000,
    timeout: 4,
  },
  // phần giành cho mongodb thêm
  //   repSet: "rs0", // Khai báo bộ db replicate
  isRoot: true, // nếu user của mongo có quyền root
  // tham số phụ thêm vào để xác định csdl có hỗ trợ tự tạo auto_increment không?
  // do oracle 11 nên không tự tạo được id tự tăng mà phải sử dụng mô hình để tạo
  auto_increment_support: false,
   */
  constructor(connCfg) {
    this.cfg = connCfg || defaultCfg;
    switch (this.cfg.type) {
      case "sqlite3":
        this.db = new SQLiteDAO(this.cfg.database, connCfg.isDebug);
        break;
      case "oracle":
        let connectString = `(DESCRIPTION =
                                            (ADDRESS_LIST =
                                                (ADDRESS = (PROTOCOL = TCP)(HOST = ${
          this.cfg.host || "localhost"
          })(PORT = ${
          this.cfg.port || 1521
          }))
                                            )
                                            (CONNECT_DATA =
                                                (SERVER = DEDICATED)
                                                (SERVICE_NAME = ${
          this.cfg.database
          })
                                            )
                                    )`;
        if (this.cfg.hosts && this.cfg.hosts.length > 1) {
          let hostString = "";
          for (let h of this.cfg.hosts)
            if (h)
              hostString += `(ADDRESS=(PROTOCOL=TCP)(HOST=${h.host})(PORT=${
                h.port || 1521
                }))`;
          connectString = `(DESCRIPTION=(LOAD_BALANCE=on)
                                        (ADDRESS_LIST= ${hostString})
                                        (CONNECT_DATA=(SERVICE_NAME=${this.cfg.database})))`;
        } else if (this.cfg.hosts && this.cfg.hosts.length === 1) {
          connectString = `(DESCRIPTION =
                                            (ADDRESS_LIST =
                                                (ADDRESS = (PROTOCOL = TCP)(HOST = ${
            this.cfg.hosts[0].host
            })(PORT = ${
            this.cfg.hosts[0].port || 1521
            }))
                                            )
                                            (CONNECT_DATA =
                                                (SERVER = DEDICATED)
                                                (SERVICE_NAME = ${
            this.cfg.database
            })
                                            )
                                    )`;
        }
        this.db = new OracleDAO({
          poolAlias:
            (this.cfg.pool ? this.cfg.pool.name : "") || "Node-Orm-Pool",
          user: this.cfg.username,
          password: this.cfg.password,
          connectString,
          poolMax: (this.cfg.pool ? this.cfg.pool.max : 0) || 2, //so luong pool max
          poolMin: (this.cfg.pool ? this.cfg.pool.min : 0) || 2, //so luong pool min
          poolIncrement: (this.cfg.pool ? this.cfg.pool.increment : 0) || 0, //so luong pool tang len neu co
          poolTimeout: (this.cfg.pool ? this.cfg.pool.timeout : 0) || 4, //thoi gian pool timeout
        }, connCfg.isDebug);
        break;
      case "mongodb":
        let hostString = `${this.cfg.host || "localhost"}:${
          this.cfg.port || 27017
          }`;
        if (this.cfg.hosts) {
          hostString = "";
          for (let ht of this.cfg.hosts) {
            if (ht)
              hostString += hostString
                ? `,${ht.host}:${ht.port}`
                : `${ht.host}:${ht.port}`;
          }
        }
        // Nếu user chỉ có quyền login vào database thôi thì phải khai database ở đây nếu không sẽ bị lỗi xác thực
        // Ngược lại, nếu DB có quyền root mà không có quyền nối vào DB mà khai db khi kết nối cũng bị lỗi xác thực
        let uri =
          `mongodb://${this.cfg.username}:${this.cfg.password}@${hostString}` +
          (this.cfg.isRoot ? `` : `/${this.cfg.database}`) +
          (this.cfg.repSet
            ? `?replicaSet=${this.cfg.repSet}`
            : `?authSource=admin`);
        this.db = new MongoDAO(uri, this.cfg.database, connCfg.isDebug);
        break;
      default:
        this.db = null;
        break;
    }
  }

  // phương thức kiểm tra kết nối db
  isConnected() {
    if (this.db) {
      {
        return this.db.isConnected();
      }
    }
    return false;
  }

  /**
   * Trả về phiên làm việc của database nó sẽ cho biết instanceof là của đối tượng thực nào
   */
  getDbInstance() {
    return this.db;
  }

  /**
   * Hàm trả về undefined nếu csdl có hỗ trợ auto increment
   * trả về giá trị id cực đại nếu không hỗ trợ auto increment
   */
  getMaxIncrement(tableName, column) {
    if (this.cfg.auto_increment_support) return new Promise((rs) => rs());
    // lấy giá trị cực đại ở csdl để trả về giá trị này
    if (this.db instanceof MongoDAO) {
      return new Promise((rs) => {
        let colMongo = column; // === "id" ? "_id" : column;
        this.db.getLastRecord(tableName, {}, Object.defineProperty({}, colMongo, {
          value: 1, writable: true,
          enumerable: true,
          configurable: true,
        }), colMongo)
          .then((rst) => {
            if (rst && rst[colMongo])
              rs(rst[colMongo])
            else
              rs(0)
          })
          .catch((err) => rs());
      });
    } else if (this.db !== null) {
      return new Promise((rs) => {
        this.db
          .getRst(`select max(${column}) as maxValue from ${tableName}`)
          .then((data) => rs(data.maxvalue))
          .catch((err) => rs());
      });
    } else new Promise((rs) => rs());
  }

  // ---  Các phương thức với bảng ---

  // tạo bảng nếu chưa tồn tại
  createTable(tableName, jsonStructure) {
    if (this.db instanceof MongoDAO) {
      return this.db.createTable(tableName, jsonStructure);
    } else if (this.db !== null) {
      // console.log("Tạo bảng ??? ", this.convertModelTableToJson(tableName, jsonStructure));
      return this.db.createTable(
        this.convertModelTableToJson(tableName, jsonStructure), jsonStructure
      );
    } else return this.errorPromise();
  }

  // các phương thức insertOne, updateWhere, deleteWhere, selectOne,

  // chèn một bảng ghi
  insertOne(tableName, jsonData = {}) {
    if (this.db instanceof MongoDAO) {
      return this.db.insert(tableName, jsonData);
    } else if (this.db !== null) {
      return this.db.insert(this.convertDaoFromMongo(tableName, {}, jsonData));
    } else return this.errorPromise();
  }

  // update theo mệnh đề where
  updateWhere(tableName, jsonData = {}, jsonWhere = {}) {
    if (this.db instanceof MongoDAO) {
      return this.db.update(tableName, jsonWhere, jsonData);
    } else if (this.db !== null) {
      return this.db.update(
        this.convertDaoFromMongo(tableName, jsonWhere, jsonData)
      );
    } else return this.errorPromise();
  }

  // xóa theo mệnh đề where
  deleteWhere(tableName, jsonWhere = {}, jsonOption = {}) {
    if (this.db instanceof MongoDAO) {
      return this.db.delete(tableName, jsonWhere, jsonOption);
    } else if (this.db !== null) {
      return this.db.delete(this.convertDaoFromMongo(tableName, jsonWhere));
    } else return this.errorPromise();
  }

  // truy vấn lấy 1 bảng ghi
  selectOne(tableName, jsonWhere = {}, jsonFields = {}, jsonSort = {}) {
    if (this.db instanceof MongoDAO) {
      return this.db.select(tableName, jsonWhere, jsonFields, jsonSort);
    } else if (this.db !== null) {
      return this.db.select(
        this.convertSelectFromMongo(tableName, jsonWhere, jsonFields, jsonSort)
      );
    } else return this.errorPromise();
  }

  // truy vấn tất cả bảng ghi
  selectAll(tableName, jsonWhere = {}, jsonFields = {}, jsonSort = {}) {
    if (this.db instanceof MongoDAO) {
      return this.db.selectAll(tableName, jsonWhere, jsonFields, jsonSort);
    } else if (this.db !== null) {
      return this.db.selectAll(
        this.convertSelectFromMongo(tableName, jsonWhere, jsonFields, jsonSort)
      );
    } else return this.errorPromise("Lỗi truy vấn dữ liệu");
  }

  // chuyển đổi mệnh đề select trong mongo cho selectDAO --> sql bình thường
  /**
   * input:
   * jsonFields = { id: 1, key: 0} ==> "select id from <tablename>"
   * jsonWhere = {id:15}       ==> "where id = 15"
   * jsonSort = {id:-1, key:1} ==> "order by id desc, key asc"
   *
   * output:
   * wheres = [{name: "id", value: 1}]
   * orderbys = [{name: "key",value: "desc"}]
   */
  convertSelectFromMongo(
    tablename,
    jsonWhere = {},
    jsonFields = {},
    jsonSort = {}
  ) {
    let jsonDao = { name: tablename, cols: [], wheres: [], orderbys: [] };

    if (jsonFields)
      for (let key in jsonFields)
        if (jsonFields[key])
          // chỉ có key nào ==1 thì mới được chọn lựa ==0 thì không lấy
          jsonDao.cols.push({ name: key });

    if (jsonWhere)
      for (let key in jsonWhere)
        jsonDao.wheres.push({ name: key, value: jsonWhere[key] });

    if (jsonSort)
      for (let key in jsonSort)
        jsonDao.orderbys.push({
          name: key,
          value: jsonSort[key] === -1 ? "desc" : "",
        });

    return jsonDao;
  }

  // chuyển đổi mệnh đề where phù hợp với mongodb
  // và cho phép update bảng ghi có where nhưng sẽ thay giá trị mới
  // jsonData, jsonWhere
  convertDaoFromMongo(tablename, jsonWhere = {}, jsonData = {}) {
    let jsonDao = { name: tablename, cols: [], wheres: [] };

    if (jsonData)
      for (let key in jsonData)
        jsonDao.cols.push({ name: key, value: jsonData[key] });

    if (jsonWhere)
      for (let key in jsonWhere)
        jsonDao.wheres.push({ name: key, value: jsonWhere[key] });

    return jsonDao;
  }

  // hàm trả về lỗi promise cho các thực thi bị sai
  errorPromise(e) {
    return new Promise((rs, rj) => rj(e || "Error with no db available!"));
  }

  /**
   * chuyển đổi cấu trúc bảng đến json phù hợp với DAO của csdl DBMS (with SQL)
   * tham số AUTOINCREMENT chỉ ứng dụng trong sqlite3, còn các cơ sở dữ liệu khác thì tùy thuộc vào nó để thay đổi cho hợp lý
   * Ví dụ oracle 12c thì phải sử dụng cụm từ GENERATED ALWAYS as IDENTITY(START with 1 INCREMENT by 1)
   * @param {*} tableName
   * @param {*} jsonStructure
   */
  convertModelTableToJson(tableName, jsonStructure) {
    let cols = [];
    for (let key in jsonStructure) {
      let el = jsonStructure[key];
      if (el && el.type) {
        let opts = `${el.primaryKey ? `PRIMARY KEY` : ``}${
          // nếu csdl nào không hổ trợ thì tắt nó đi và sử dụng mô hình model để tạo id tự động
          !el.autoIncrement || !this.cfg.auto_increment_support
            ? ``
            : this.db instanceof SQLiteDAO
              ? ` AUTOINCREMENT`
              : this.db instanceof OracleDAO
                ? ` GENERATED ALWAYS as IDENTITY(START with 1 INCREMENT by 1)`
                : ``
          }${el.notNull ? ` NOT NULL` : ``}${el.isUnique ? ` UNIQUE` : ``}${
          el.defaultValue ? ` default ${el.defaultValue}` : ``
          }`;
        cols.push({ name: key, type: el.type, option_key: opts });
      } else cols.push({ name: key, type: el });
    }
    return { name: tableName, cols };
  }
}
module.exports = NodeDatabase;
