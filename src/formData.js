export const formData = [
    {
      component: "page",
      label: "Use Case 1",
      _uid: "0c946643-5a83-4545-baea-055b27b51e8a",
      fields: [
        {
          component: "text",
          label: "Name of function to call when button is clicked",
          type: "text",
          _uid: "functionHandlerName"
        },
        {
          component: "text",
          label: "The button text",
          type: "text",
          _uid: "buttonText"
        },
        {
          component: "text",
          label: "CSS class name",
          type: "text",
          _uid: "cssClassName"
        }
      ],
      codeSnippet: 
`{{functionHandlerName}} = () => {
    //do the thing here
}

render() {
    return (
        <div>
            <button {{cssClassName}}="..."
                    onClick={ this.{{functionHandlerName}} }>
                {{buttonText}}
            </button>
        </div>
    )
};`
    },
    {
      component: "page",
      label: "Use Case 2",
      comment: "This is just an experiment",
      _uid: "0c946643-5a83-4545-baea-055b27b51e8b",
      fields: [
        {
          component: "text",
          label: "Namespace root. Example: 'PlannerEventService'",
          type: "text",
          _uid: "namespaceRoot"
        },
        {
          component: "text",
          label: "Controller Class name. Example: 'EventController'",
          type: "text",
          _uid: "className"
        }
      ],
      codeSnippet: 
`using Microsoft.AspNetCore.Mvc;
using {{namespaceRoot}}.Api.Models.DataEntities;
using {{namespaceRoot}}.Api.Models.DTOs;
using {{namespaceRoot}}.Api.Models.Mapper;
using {{namespaceRoot}}.Api.Services;
using Swashbuckle.AspNetCore.Annotations;
using System.Text.Json;

namespace {{namespaceRoot}}.Api.Controllers;

[Route("api/v1/[controller]")]
[ApiController]
[ApiConventionType(typeof(DefaultApiConventions))] // More info: https://docs.microsoft.com/en-us/aspnet/core/web-api/advanced/conventions?view=aspnetcore-6.0
[Attributes.ApiKey]
[Produces("application/json")]
public class {{className}} : ControllerBase {
    private readonly ILogger<{{className}}> _logger;
    private readonly IMappingService _mapper;
    private readonly IEventPlannerService _eventService;

    public {{className}}(ILogger<{{className}}> logger, IMappingService mapper, IEventPlannerService eventService) {
        _logger = logger;
        _mapper = mapper;
        _eventService = eventService;
    }

    /// <summary>
    /// Get details for a specific Planner Event.
    /// </summary>
    /// <remarks>
    /// When called via the proxy api in Connexus, idWebuser is a required query parameter.
    /// </remarks>
    /// <param name="id"></param>
    /// <param name="timeZone"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>A Planner Event Object</returns>
    /// <response code="200">Returns the found Planner Event</response>
    /// <response code="404">If event is not found</response>
    [HttpGet("{id}")]
    public async Task<ActionResult<GetEventDetailDto>> Get(int id, string timeZone, CancellationToken cancellationToken) {

        using (_logger.BeginScope("Get Event"))
        using (_logger.BeginScope(new Dictionary<string, object> {
            ["idEvent"] = id,
            ["timeZone"] = timeZone,
        })) {

            // Do this up front. If we get a bogus timezone, lets bonk here and not query the db.
            var timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timeZone);

            var foundEvent = await _eventService.GetEventAsync(id, cancellationToken);

            if (foundEvent == null) {
                _logger.LogInformation("Event not found with id: {id}", id);
                return NotFound(new Exception("Event not found"));
            }

            // We don't get the timezone info from the database but we might need it to account for DST when mapping to the DTO.
            foundEvent.IdTimeZoneFromDotNet = timeZoneInfo.Id;

            var dto = _mapper.Map<PlannerEvent, GetEventDetailDto>(foundEvent);

            if (_logger.IsEnabled(LogLevel.Information)) {
                _logger.LogInformation("Event found: {plannerEvent}", JsonSerializer.Serialize(foundEvent));
            }

            return Ok(dto);
        }
    }


    /// <summary>
    /// Get a list of Planner Events for a given idWebuser within a dateRange.
    /// </summary>
    /// <param name="findEventsForRange"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>A collection of PlannerEvents</returns>
    /// <response code="200">Returns a populated collection of PlannerEvent objects</response>
    /// <response code="404">No events found for given criteria</response>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<GetEventSummaryDto>>> Get([FromQuery] FindEventsForRangeDto findEventsForRange, CancellationToken cancellationToken) {
        using (_logger.BeginScope("Get Events"))
        using (_logger.BeginScope(new Dictionary<string, object> {
            ["idWebuser"] = findEventsForRange.IdWebuser,
            ["startDate"] = findEventsForRange.StartDate,
            ["endDate"] = findEventsForRange.EndDate,
        })) {

            var eventsForWebuser = await _eventService.GetEventsAsync(findEventsForRange.IdWebuser, findEventsForRange.StartDate, findEventsForRange.EndDate, cancellationToken);

            var events = _mapper.Map<EventsForWebuser, IEnumerable<GetEventSummaryDto>>(eventsForWebuser);
            if (!events.Any()) {
                _logger.LogInformation("{{className}} Get - No events found for parameters: {FindEventsForRangeDto}", JsonSerializer.Serialize(findEventsForRange));
                return NotFound(new Exception("No events found"));
            }
            var sortedEvents = events.OrderBy(evt => evt.Start);

            return Ok(sortedEvents);
        }
    }


    /// <summary>
    /// Creates a new Planner Event.
    /// </summary>
    /// <param name="newEvent"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>Returns the newly created Planner Event</returns>
    /// <response code="201">Returns the newly created Planner Event</response>
    /// <response code="400">If no event was included in request body</response>
    [SwaggerResponse(201, type: typeof(InsertEventDetailDto))]
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] InsertEventDto newEvent, CancellationToken cancellationToken) {

        using (_logger.BeginScope("Insert Event"))
        using (_logger.BeginScope(new Dictionary<string, object> {
            ["idWebuser"] = newEvent.IdWebuser,
        })) {

            var plannerEvent = _mapper.Map<InsertEventDto, PlannerEvent>(newEvent);
            var result = await _eventService.CreateEventAsync(plannerEvent, cancellationToken);
            var plannedEventDetailsDto = _mapper.Map<PlannerEvent, InsertEventDetailDto>(result);

            if (_logger.IsEnabled(LogLevel.Information)) {
                _logger.LogInformation("{{className}} Post - created: {plannerEvent}", JsonSerializer.Serialize(plannerEvent));
            }
            return CreatedAtAction(nameof(Post), newEvent, plannedEventDetailsDto);
        }
    }

    /// <summary>
    /// Updates an existing Planner Event.
    /// </summary>
    /// <param name="updatedEvent"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>Returns the newly created Planner Event</returns>
    /// <response code="201">Returns the newly created Planner Event</response>
    /// <response code="400">If no event was included in request body</response>
    /// <response code="404">If event is not found</response>
    [HttpPut]
    public async Task<IActionResult> Put([FromBody] UpdateEventDto updatedEvent, CancellationToken cancellationToken) {

        using (_logger.BeginScope("Update Event"))
        using (_logger.BeginScope(new Dictionary<string, object> {
            ["idEvent"] = updatedEvent.Id,
        })) {

            var plannerEvent = _mapper.Map(updatedEvent, new PlannerEvent());
            var result = await _eventService.UpdateEventAsync(plannerEvent, cancellationToken);

            if (result == null) {
                _logger.LogInformation("{{className}} Put - Event not found: {plannerEvent}", JsonSerializer.Serialize(plannerEvent));
                return NotFound(new Exception("Event not found"));
            }

            var plannedEventDetailsDto = _mapper.Map<PlannerEvent, GetEventDetailDto>(result);

            if (_logger.IsEnabled(LogLevel.Information)) {
                _logger.LogInformation("{{className}} Put - updated: {plannerEvent}", JsonSerializer.Serialize(plannerEvent));
            }

            return Ok(plannedEventDetailsDto);
        }

    }

    /// <summary>
    /// Delete an existing Planner Event.
    /// </summary>
    /// <param name="id"></param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    /// <response code="200">Returns 200 when successful</response>
    /// <response code="400">If no event id was included in request</response>
    /// <response code="404">If event is not found</response>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken) {

        using (_logger.BeginScope("Delete Event"))
        using (_logger.BeginScope(new Dictionary<string, object> {
            ["idEvent"] = id,
        })) {

            var result = await _eventService.DeleteEventAsync(id, cancellationToken);

            if (result == 0) {
                _logger.LogInformation("Event not found with id: {id}", id);
                return NotFound(new Exception("Event not found"));
            }

            _logger.LogInformation("Deleted event: {id}", id);
            return Ok();
        }

    }
}
`
    },
    {
      component: "page",
      label: "DB Script - users and roles for hybrid connection",
      comment: "This works",
      _uid: "0c946643-5a83-4545-baea-055b25b51e8a",
      fields: [
        {
          component: "text",
          label: "Main comment. Example: Creating database users and roles for PlannerEvent API Hybrid Connection Manager (HCM) Account for querying V2 System.",
          type: "text",
          _uid: "mainComment"
        },
        {
          component: "text",
          label: "Secondary comment. Example: Related TFS Work Item # 195690 and Azure DevOps Work Item #s 594037, 592328.",
          type: "text",
          _uid: "secondaryComment"
        },
        {
          component: "text",
          label: "DB Login(readonly). Example: plannerEventServiceReadOnly",
          type: "text",
          _uid: "dbLoginReadOnly"
        },
        {
          component: "text",
          label: "DB Login(readwrite). Example: plannerEventServiceReadWrite",
          type: "text",
          _uid: "dbLoginReadWrite"
        },
        {
          component: "text",
          label: "DB Role(readonly). Example: plannerEventReadOnly",
          type: "text",
          _uid: "dbRoleReadOnly"
        },
        {
          component: "text",
          label: "DB Role(readwrite). Example: plannerEventReadWrite",
          type: "text",
          _uid: "dbRoleReadWrite"
        },
        {
          component: "text",
          label: "DB User(readonly). Example: plannerEventServiceReadOnly",
          type: "text",
          _uid: "dbUserReadOnly"
        },
        {
          component: "text",
          label: "DB User(readwrite). Example: plannerEventServiceReadWrite",
          type: "text",
          _uid: "dbUserReadWrite"
        }
      ],
      codeSnippet: 
`SET NOCOUNT ON;
DECLARE @startTime  DATETIME2(4)    = SYSDATETIME()
,       @endTime    DATETIME2(4)
,       @CRLF       CHAR(2)         = CONCAT(CHAR(13), CHAR(10));

DECLARE @message VARCHAR(1500) = FORMATMESSAGE('Script started at %s on %s', CAST(@startTime AS VARCHAR(30)), @@SERVERNAME);

RAISERROR('Expected execution time for this script: zero (0) seconds', 0, 1) WITH NOWAIT;
RAISERROR(@message, 0, 1) WITH NOWAIT;
RAISERROR('-----------------------------------------------------------------', 0, 1) WITH NOWAIT;
RAISERROR('{{mainComment}}', 0, 1) WITH NOWAIT;
RAISERROR('{{secondaryComment}}', 0, 1) WITH NOWAIT;

----------- Confirm expected ReadOnly login exists; terminate script in ERROR if not
IF NOT EXISTS (SELECT TOP(1) 1 FROM sys.server_principals WHERE type_desc = 'SQL_LOGIN' AND name = N'{{dbLoginReadOnly}}')
    BEGIN;
        SELECT @endTime = SYSDATETIME()
        ,       @message = CONCAT   (
                                            @CRLF, '**** ', FORMAT(@endTime, 'MM/dd/yyyy hh:mm:ss.ms', 'en-US'), ' ****', @CRLF, CHAR(9)
                                        ,   'ERROR: Cannot create database user. The required login ''{{dbLoginReadOnly}}'' does not exist.', @CRLF
                                        ,
                                        '-----------------------------------------------------------------', @CRLF
                                        ,   FORMATMESSAGE('Script ended at %s on %s', CAST(@endTime AS VARCHAR(30)), @@SERVERNAME), @CRLF
                                        ,   CONCAT('Actual execution time of script: ', DATEDIFF(SECOND, @startTime, @endTime), ' seconds (', DATEDIFF(MILLISECOND, @startTime, @endTime), ' milliseconds).')
                                    );
        THROW 50000, @message, 1;
    END;

----------- Confirm expected ReadWrite login exists; terminate script in ERROR if not
IF NOT EXISTS (SELECT TOP(1) 1 FROM sys.server_principals WHERE type_desc = 'SQL_LOGIN' AND name = N'{{dbLoginReadWrite}}')
    BEGIN;
        SELECT  @endTime = SYSDATETIME()
        ,       @message = CONCAT   (
                                            @CRLF, '**** ', FORMAT(@endTime, 'MM/dd/yyyy hh:mm:ss.ms', 'en-US'), ' ****', @CRLF, CHAR(9)
                                        ,   'ERROR: Cannot create database user. The required login ''{{dbLoginReadWrite}}'' does not exist.', @CRLF
                                        ,
                                        '-----------------------------------------------------------------', @CRLF
                                        ,   FORMATMESSAGE('Script ended at %s on %s', CAST(@endTime AS VARCHAR(30)), @@SERVERNAME), @CRLF
                                        ,   CONCAT('Actual execution time of script: ', DATEDIFF(SECOND, @startTime, @endTime), ' seconds (', DATEDIFF(MILLISECOND, @startTime, @endTime), ' milliseconds).')
                                    );
        THROW 50000, @message, 1;
    END;

----------- Create the read-only role
IF NOT EXISTS (SELECT TOP(1) 1 FROM sys.database_principals WHERE type_desc = 'DATABASE_ROLE' AND name = N'{{dbRoleReadOnly}}')
    BEGIN;
        RAISERROR('Executing: CREATE ROLE {{dbRoleReadOnly}} AUTHORIZATION dbo;', 0, 1) WITH NOWAIT;
        CREATE ROLE {{dbRoleReadOnly}} AUTHORIZATION dbo;
        RAISERROR('Created role ''{{dbRoleReadOnly}}'' in database.', 0, 1) WITH NOWAIT;
    END;
ELSE
    BEGIN;
        RAISERROR('Role ''{{dbRoleReadOnly}}'' already exists in database.', 0, 1) WITH NOWAIT;
    END;

----------- Create the read-only user
IF NOT EXISTS (SELECT TOP(1) 1 FROM sys.database_principals WHERE type_desc = 'SQL_USER' AND name = N'{{dbUserReadOnly}}')
    BEGIN;
        RAISERROR('Executing: CREATE USER {{dbUserReadOnly}} FOR LOGIN {{dbLoginReadOnly}} WITH DEFAULT_SCHEMA = dbo;', 0, 1) WITH NOWAIT;
        CREATE USER {{dbUserReadOnly}} FOR LOGIN {{dbLoginReadOnly}} WITH DEFAULT_SCHEMA = dbo;
        RAISERROR('Created user ''{{dbUserReadOnly}}'' for LOGIN ''{{dbLoginReadOnly}}'' in database.', 0, 1) WITH NOWAIT;
    END;
ELSE
    BEGIN;
        RAISERROR('User ''{{dbUserReadOnly}}'' already exists in database.', 0, 1) WITH NOWAIT;
    END;

-- Add the read-only user to the read-only role
RAISERROR('Executing: ALTER ROLE {{dbRoleReadOnly}} ADD MEMBER {{dbUserReadOnly}};', 0, 1) WITH NOWAIT;
ALTER ROLE {{dbRoleReadOnly}} ADD MEMBER {{dbUserReadOnly}};
RAISERROR('Added user ''{{dbUserReadOnly}}'' to role ''{{dbRoleReadOnly}}'' in database.', 0, 1) WITH NOWAIT;

----------- Create the read-write role
IF NOT EXISTS (SELECT TOP(1) 1 FROM sys.database_principals WHERE type_desc = 'DATABASE_ROLE' AND name = N'{{dbRoleReadWrite}}')
    BEGIN;
        RAISERROR('Executing: CREATE ROLE {{dbRoleReadWrite}} AUTHORIZATION dbo;', 0, 1) WITH NOWAIT;
        CREATE ROLE {{dbRoleReadWrite}} AUTHORIZATION dbo;
        RAISERROR('Created role ''{{dbRoleReadWrite}}'' in database.', 0, 1) WITH NOWAIT;
    END;
ELSE
    BEGIN;
        RAISERROR('Role ''{{dbRoleReadWrite}}'' already exists in database.', 0, 1) WITH NOWAIT;
    END;

----------- Create the read-write user
IF NOT EXISTS (SELECT TOP(1) 1 FROM sys.database_principals WHERE type_desc = 'SQL_USER' AND name = N'{{dbUserReadWrite}}')
    BEGIN;
        RAISERROR('Executing: CREATE USER {{dbUserReadWrite}} FOR LOGIN {{dbLoginReadWrite}} WITH DEFAULT_SCHEMA = dbo;', 0, 1) WITH NOWAIT;
        CREATE USER {{dbUserReadWrite}} FOR LOGIN {{dbLoginReadWrite}} WITH DEFAULT_SCHEMA = dbo;
        RAISERROR('Created user ''{{dbUserReadWrite}}'' for LOGIN ''{{dbLoginReadWrite}}'' in database.', 0, 1) WITH NOWAIT;
    END;
ELSE
    BEGIN;
        RAISERROR('User ''{{dbUserReadWrite}}'' already exists in database.', 0, 1) WITH NOWAIT;
    END;

-- Add the read-write user to the read-write role
RAISERROR('Executing: ALTER ROLE {{dbRoleReadWrite}} ADD MEMBER {{dbUserReadWrite}};', 0, 1) WITH NOWAIT;
ALTER ROLE {{dbRoleReadWrite}} ADD MEMBER {{dbUserReadWrite}};
RAISERROR('Added user ''{{dbUserReadWrite}}'' to role ''{{dbRoleReadWrite}}'' in database.', 0, 1) WITH NOWAIT;

-- Grant the appropriate permissions to the read-only role
RAISERROR('Granting: GRANT EXECUTE, SELECT TO {{dbRoleReadOnly}};', 0, 1) WITH NOWAIT;
GRANT EXECUTE, SELECT TO {{dbRoleReadOnly}};
RAISERROR('Granted EXECUTE, SELECT to role ''{{dbRoleReadOnly}}'' in database.', 0, 1) WITH NOWAIT;

-- Grant the appropriate permissions to the read-write role
RAISERROR('Granting: GRANT EXECUTE, SELECT TO {{dbRoleReadWrite}};', 0, 1) WITH NOWAIT;
GRANT EXECUTE, SELECT TO {{dbRoleReadWrite}};
RAISERROR('Granted EXECUTE, SELECT to role ''{{dbRoleReadWrite}}'' in database.', 0, 1) WITH NOWAIT;

SELECT  @endTime    = SYSDATETIME()
,       @message    = FORMATMESSAGE('Script ended at %s on %s', CAST(@endTime AS VARCHAR(30)), @@SERVERNAME);

RAISERROR('-----------------------------------------------------------------', 0, 1) WITH NOWAIT;
RAISERROR(@message, 0, 1) WITH NOWAIT;

SET @message = CONCAT('Actual execution time of script: ', DATEDIFF(SECOND, @startTime, @endTime), ' seconds (', DATEDIFF(MILLISECOND, @startTime, @endTime), ' milliseconds).');
RAISERROR(@message, 0, 1) WITH NOWAIT;
`
    },
    {
      component: "page",
      label: "Dot Net API Repository",
      comment: "Not sure on status",
      _uid: "0c948343-5a83-4545-baea-055b25b51e8a",
      fields: [
        {
          component: "text",
          label: "Namespace root. Example: PlannerEventService",
          type: "text",
          _uid: "namespaceRoot"
        },
        {
          component: "text",
          label: "Class name. Example: PlannerEventRepository",
          type: "text",
          _uid: "className"
        },
        {
          component: "text",
          label: "DB Entity-Pascal. Example: PlannerEvent",
          type: "text",
          _uid: "dbEntityPascal"
        },
        {
          component: "text",
          label: "DB Entity-Camel. Example: plannerEvent",
          type: "text",
          _uid: "dbEntityCamel"
        },
        {
          component: "text",
          label: "Entity-Display-Pascal. Example: Event",
          type: "text",
          _uid: "dbEntityDisplayPascal"
        },
        {
          component: "text",
          label: "Entity-Display-Camel. Example: event",
          type: "text",
          _uid: "dbEntityDisplayCamel"
        },
        {
          component: "text",
          label: "Entity-Display-All-Caps. Example: EVENT",
          type: "text",
          _uid: "dbEntityDisplayAllCaps"
        }
      ],
      codeSnippet: 
`
using {{namespaceRoot}}.Api.Models.DataEntities;
using {{namespaceRoot}}.Api.Repositories.Parameters;

namespace {{namespaceRoot}}.Api.Repositories;

public interface I{{className}} {
    public Task<{{dbEntityPascal}}?> Get{{dbEntityDisplayPascal}}Async(int id{{dbEntityDisplayPascal}}, CancellationToken cancellationToken);
    public Task<IEnumerable<{{dbEntityDisplayPascal}}>> Get{{dbEntityDisplayPascal}}sAsync(Get{{dbEntityDisplayPascal}}Parameters parameters, CancellationToken cancellationToken);
    public Task<{{dbEntityPascal}}> Create{{dbEntityDisplayPascal}}Async({{dbEntityPascal}} {{dbEntityCamel}}, CancellationToken cancellationToken);
    public Task<{{dbEntityPascal}}?> Update{{dbEntityDisplayPascal}}Async({{dbEntityPascal}} {{dbEntityCamel}}, CancellationToken cancellationToken);
    public Task<int> Delete{{dbEntityDisplayPascal}}Async(int id{{dbEntityDisplayPascal}}, CancellationToken cancellationToken);
}

//==========================================================================================

namespace {{namespaceRoot}}.Api.Repositories.Parameters;

public class Get{{dbEntityPascal}}Parameters {
    public int IdWebuser { get; set; }
    public DateTime Start { get; set; }
    public DateTime Finish { get; set; }
    public double TimeZoneOffset { get; set; }
}

//==========================================================================================

using Dapper;
using {{namespaceRoot}}.Api.Exceptions;
using {{namespaceRoot}}.Api.Factories;
using {{namespaceRoot}}.Api.Helpers;
using {{namespaceRoot}}.Api.Models.DataEntities;
using {{namespaceRoot}}.Api.Repositories.Parameters;
using System.Data;
using System.Data.SqlClient;
using System.Text.Json;

namespace {{namespaceRoot}}.Api.Repositories;

public class {{className}} : I{{className}} {
    private readonly IDatabaseConnectionFactory _connectionFactory;

    private const string {{dbEntityDisplayAllCaps}}_GET = "{{dbEntityDisplayCamel}}_get";
    private const string {{dbEntityDisplayAllCaps}}S_GET = "{{dbEntityDisplayCamel}}s_get";
    private const string {{dbEntityDisplayAllCaps}}_INSERT = "{{dbEntityDisplayCamel}}_insert";
    private const string {{dbEntityDisplayAllCaps}}_UPDATE = "{{dbEntityDisplayCamel}}_update";
    private const string {{dbEntityDisplayAllCaps}}_DELETE = "{{dbEntityDisplayCamel}}_delete";

    public {{className}}(IDatabaseConnectionFactory connectionFactory) {
        _connectionFactory = connectionFactory;
    }

    public async Task<{{dbEntityPascal}}?> Get{{dbEntityDisplayPascal}}Async(int id{{dbEntityDisplayPascal}}, CancellationToken cancellationToken) {
        using var db = (SqlConnection)_connectionFactory.GetReadonlyConnection();
        await db.OpenAsync(cancellationToken);

        var result = await db.QueryFirstOrDefaultAsync<{{dbEntityPascal}}>({{dbEntityDisplayAllCaps}}_GET, new { id{{dbEntityDisplayPascal}} }, commandType: CommandType.StoredProcedure);

        if (result != null) {
            result.Id{{dbEntityDisplayPascal}} = id{{dbEntityDisplayPascal}};
        }

        return result;
    }

    public async Task<IEnumerable<{{dbEntityDisplayPascal}}>> Get{{dbEntityDisplayPascal}}sAsync(Get{{dbEntityDisplayPascal}}Parameters parameters, CancellationToken cancellationToken) {
        using var db = (SqlConnection)_connectionFactory.GetReadonlyConnection();
        await db.OpenAsync(cancellationToken);

        var result = await db.QueryAsync<{{dbEntityDisplayPascal}}>({{dbEntityDisplayAllCaps}}S_GET, parameters, commandType: CommandType.StoredProcedure);

        return result;
    }

    public async Task<{{dbEntityPascal}}> Create{{dbEntityDisplayPascal}}Async({{dbEntityPascal}} {{dbEntityCamel}}, CancellationToken cancellationToken) {
        var {{dbEntityDisplayCamel}}Params = new DynamicParameters();
        {{dbEntityDisplayCamel}}Params.Add("id{{dbEntityDisplayPascal}}", dbType: DbType.Int32, direction: ParameterDirection.ReturnValue);
        {{dbEntityDisplayCamel}}Params.AddDynamicParams(new {
            affectsLessonSchedule = {{dbEntityCamel}}.AffectsLessonSchedule
            , blocksAttendance = {{dbEntityCamel}}.BlocksAttendance
            , created = {{dbEntityCamel}}.Created
            , description = {{dbEntityCamel}}.Description
            , educationalMinutes = {{dbEntityCamel}}.EducationalMinutes == 0 ? null : {{dbEntityCamel}}.EducationalMinutes
            , finish = {{dbEntityCamel}}.Finish
            , id{{dbEntityDisplayPascal}}Subject = {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}Subject == 0 ? null : {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}Subject
            , id{{dbEntityDisplayPascal}}Type = {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}Type
            , idLesson = {{dbEntityCamel}}.IdLesson == 0 ? null : {{dbEntityCamel}}.IdLesson
            , idSection = {{dbEntityCamel}}.IdSection == 0 ? null : {{dbEntityCamel}}.IdSection
            , name = {{dbEntityCamel}}.Name
            , start = {{dbEntityCamel}}.Start
        });

        using var db = (SqlConnection)_connectionFactory.GetConnection();
        await db.OpenAsync(cancellationToken);
        using var tran = await db.BeginTransactionAsync(cancellationToken);

        await db.ExecuteAsync({{dbEntityDisplayAllCaps}}_INSERT, {{dbEntityDisplayCamel}}Params, tran, commandType: CommandType.StoredProcedure);

        {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}} = {{dbEntityDisplayCamel}}Params.Get<int>("id{{dbEntityDisplayPascal}}");

        if ({{dbEntityCamel}}.Id{{dbEntityDisplayPascal}} == 0) {
            throw new Exception($"{{dbEntityDisplayPascal}} creation failed for {{dbEntityDisplayCamel}}: {JsonSerializer.Serialize({{dbEntityCamel}})}");
        }

        //Add applicable code here that touches the database
        //If no other code is needed then a transaction may not be necessary

        await tran.CommitAsync(cancellationToken);

        return {{dbEntityCamel}};
    }

    public async Task<{{dbEntityPascal}}?> Update{{dbEntityDisplayPascal}}Async({{dbEntityPascal}} {{dbEntityCamel}}, CancellationToken cancellationToken) {
        using var db = (SqlConnection)_connectionFactory.GetConnection();
        await db.OpenAsync(cancellationToken);

        // Getting {{dbEntityDisplayCamel}} if necessary to check if it exists etc
        var {{dbEntityDisplayCamel}}ToUpdate = await db.QueryFirstOrDefaultAsync<{{dbEntityPascal}}>({{dbEntityDisplayAllCaps}}_GET, new { @id{{dbEntityDisplayPascal}} = {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}} }, commandType: CommandType.StoredProcedure);

        if ({{dbEntityDisplayCamel}}ToUpdate == null) {
            throw new NotFoundException($"{{dbEntityDisplayPascal}} update failed. No {{dbEntityDisplayCamel}} found for id{{dbEntityDisplayPascal}}: {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}");
        }

        var {{dbEntityDisplayCamel}}Params = new {
            id{{dbEntityDisplayPascal}} = {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}
            , affectsLessonSchedule = {{dbEntityCamel}}.AffectsLessonSchedule
            , blocksAttendance = {{dbEntityCamel}}.BlocksAttendance
            , created = {{dbEntityDisplayCamel}}ToUpdate.Created
            , description = {{dbEntityCamel}}.Description
            , educationalMinutes = {{dbEntityCamel}}.EducationalMinutes
            , finish = {{dbEntityCamel}}.Finish
            , id{{dbEntityDisplayPascal}}Subject = {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}Subject
            , id{{dbEntityDisplayPascal}}Type = {{dbEntityCamel}}.Id{{dbEntityDisplayPascal}}Type
            , idLesson = {{dbEntityCamel}}.IdLesson
            , idSection = {{dbEntityCamel}}.IdSection
            , name = {{dbEntityCamel}}.Name
            , start = {{dbEntityCamel}}.Start
        };

        using var tran = await db.BeginTransactionAsync(cancellationToken);

        var {{dbEntityDisplayCamel}}Result = await db.ExecuteAsync({{dbEntityDisplayAllCaps}}_UPDATE, {{dbEntityDisplayCamel}}Params, tran, commandType: CommandType.StoredProcedure);

        if ({{dbEntityDisplayCamel}}Result == 0) {
            return null;
        }

        if ({{dbEntityDisplayCamel}}Result != 1) {
            throw new Exception($"{{dbEntityDisplayPascal}} update failed for {{dbEntityDisplayCamel}}: {JsonSerializer.Serialize({{dbEntityCamel}})}");
        }

        //Add applicable code here that touches the database
        //If no other code is needed then a transaction may not be necessary

        await tran.CommitAsync(cancellationToken);

        return {{dbEntityCamel}};
    }

    public async Task<int> Delete{{dbEntityDisplayPascal}}Async(int id{{dbEntityDisplayPascal}}, CancellationToken cancellationToken) {
        using var db = (SqlConnection)_connectionFactory.GetConnection();
        await db.OpenAsync(cancellationToken);
        using var tran = await db.BeginTransactionAsync(cancellationToken);

        var {{dbEntityDisplayCamel}}ToDelete = await db.QueryFirstOrDefaultAsync<{{dbEntityPascal}}>({{dbEntityDisplayAllCaps}}_GET, new { id{{dbEntityDisplayPascal}} }, tran, commandType: CommandType.StoredProcedure);

        if ({{dbEntityDisplayCamel}}ToDelete == null) {
            return 0;
        }

        var result = await db.ExecuteAsync({{dbEntityDisplayAllCaps}}_DELETE, new { id{{dbEntityDisplayPascal}} }, tran, commandType: CommandType.StoredProcedure);

        //Add applicable code here that touches the database
        //If no other code is needed then a transaction may not be necessary

        await tran.CommitAsync(cancellationToken);

        return result;
    }
}

`
    },
    {
      component: "page",
      label: "Page 2",
      _uid: "3a30803f-135f-442c-ab6e-d44d7d7a5164",
      fields: [
        {
          component: "options",
          label: "Radio Buttons",
          type: "radio",
          _uid: "bd90f44a-d479-49ae-ad66-c2c475dca66b",
          options: [
            {
              component: "option",
              label: "Option 1",
              value: "one"
            },
            {
              component: "option",
              label: "Option 2",
              value: "two"
            }
          ]
        },
        {
          component: "text",
          label: "Conditional Field",
          type: "text",
          _uid: "bd90f44a-d479-49ae-ad66-c2c475daa66b",
          conditional: {
            value: "two",
            field:
              "3a30803f-135f-442c-ab6e-d44d7d7a5164_bd90f44a-d479-49ae-ad66-c2c475dca66b"
          }
        }
      ]
    },
    {
      component: "page",
      label: "Page 3a",
      _uid: "cd392929-c62e-4cdb-b4dd-914035c1cc8d",
      conditional: {
        value: "one",
        field:
          "3a30803f-135f-442c-ab6e-d44d7d7a5164_bd90f44a-d479-49ae-ad66-c2c475dca66b"
      },
      fields: [
        {
          component: "options",
          label: "More radio buttons",
          type: "radio",
          _uid: "a15bef56-ab67-4b98-a781-4441cc3bba56",
          options: [
            { component: "option", label: "Option 1", value: "one" },
            { component: "option", label: "Option 2", value: "two" }
          ]
        }
      ]
    },
    {
      component: "page",
      label: "Page 3b",
      _uid: "1dd4ec7c-fb53-47f4-af1b-1ab8f805b888",
      conditional: {
        value: "two",
        field:
          "3a30803f-135f-442c-ab6e-d44d7d7a5164_bd90f44a-d479-49ae-ad66-c2c475dca66b"
      },
      fields: [
        {
          component: "options",
          label: "Something to toggle",
          type: "radio",
          _uid: "3ca9237d-e225-4950-a298-f81ce996cb85",
          options: [
            {
              component: "option",
              label: "Option 1",
              value: "one"
            },
            { component: "option", label: "Option 2", value: "two" }
          ]
        },
        {
          component: "field_group",
          label: "Name",
          _uid: "b8406cb5-ff0d-4a83-a8f8-99740b6d91f7",
          fields: [
            {
              component: "text",
              label: "First Name",
              type: "text",
              _uid: "c6e065e1-dbcb-44ea-831f-ac3af889e964"
            },
            {
              component: "text",
              label: "Last Name",
              type: "text",
              _uid: "e279ba9c-3c9b-4df8-b267-d14b3c2adcdd"
            }
          ]
        },
        {
          component: "text",
          label: "Email",
          type: "email",
          _uid: "a95208a0-7673-48a8-b704-2fb408fa6eec"
        },
        {
          component: "text",
          label: "Phone",
          type: "text",
          _uid: "8dde5083-0619-42d6-8fc7-0563c35d03ad"
        }
      ]
    },
    {
      component: "page",
      label: "Page 4",
      _uid: "0c946643-5a83-4545-baea-065b27b51e8a",
      fields: [
        {
          component: "text",
          label: "Final Comment",
          type: "text",
          _uid: "f61231e8-565e-43d0-9c14-7d7f220c6020"
        }
      ]
    }
  ];
  